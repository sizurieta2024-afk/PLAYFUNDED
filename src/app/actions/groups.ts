"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasTradingGroupAccess } from "@/lib/group-access";
import { createServerClient } from "@/lib/supabase";
import {
  generateTradingGroupCode,
  MAX_TRADING_GROUP_MEMBERS,
  normalizeTradingGroupCode,
} from "@/lib/trading-groups";

type GroupActionResult = { error?: string };

const groupNameSchema = z.object({
  name: z.string().trim().min(3).max(60),
});

const groupCodeSchema = z.object({
  code: z.string().trim().min(4).max(16),
});

const userIdSchema = z.object({
  userId: z.string().uuid(),
});

function revalidateGroupPages() {
  revalidatePath("/dashboard/groups");
  revalidatePath("/en/dashboard/groups");
  revalidatePath("/pt-BR/dashboard/groups");
}

async function getAuthUser() {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser) return null;

  return prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: { id: true },
  });
}

function isUniqueConflict(error: unknown, field?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;

  if (!field) return true;
  const target = error.meta?.target;
  return Array.isArray(target) && target.includes(field);
}

export async function createTradingGroup(
  input: z.infer<typeof groupNameSchema>,
): Promise<GroupActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "unauthenticated" };

  const parsed = groupNameSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_name" };

  if (!(await hasTradingGroupAccess(user.id))) {
    return { error: "purchase_required" };
  }

  const existingMembership = await prisma.tradingGroupMember.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (existingMembership) return { error: "already_in_group" };

  const existingOwnedGroup = await prisma.tradingGroup.findUnique({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (existingOwnedGroup) return { error: "already_owns_group" };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const code = generateTradingGroupCode();

      await prisma.tradingGroup.create({
        data: {
          ownerId: user.id,
          name: parsed.data.name,
          code,
          members: {
            create: {
              userId: user.id,
              role: "owner",
            },
          },
        },
      });

      revalidateGroupPages();
      return {};
    } catch (error) {
      if (isUniqueConflict(error, "code")) continue;
      if (isUniqueConflict(error, "ownerId")) {
        return { error: "already_owns_group" };
      }
      if (isUniqueConflict(error, "userId")) {
        return { error: "already_in_group" };
      }
      console.error("[groups] create failed", error);
      return { error: "unknown" };
    }
  }

  return { error: "code_generation_failed" };
}

export async function joinTradingGroup(
  input: z.infer<typeof groupCodeSchema>,
): Promise<GroupActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "unauthenticated" };

  const parsed = groupCodeSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_code" };

  if (!(await hasTradingGroupAccess(user.id))) {
    return { error: "purchase_required" };
  }

  const existingMembership = await prisma.tradingGroupMember.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (existingMembership) return { error: "already_in_group" };

  try {
    const code = normalizeTradingGroupCode(parsed.data.code);
    const result = await prisma.$transaction(
      async (tx) => {
        const group = await tx.tradingGroup.findUnique({
          where: { code },
          select: {
            id: true,
            _count: { select: { members: true } },
          },
        });

        if (!group) return { error: "group_not_found" };
        if (group._count.members >= MAX_TRADING_GROUP_MEMBERS) {
          return { error: "group_full" };
        }

        await tx.tradingGroupMember.create({
          data: {
            groupId: group.id,
            userId: user.id,
          },
        });

        return {};
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.error) return result;
  } catch (error) {
    if (isUniqueConflict(error, "userId")) return { error: "already_in_group" };
    console.error("[groups] join failed", error);
    return { error: "unknown" };
  }

  revalidateGroupPages();
  return {};
}

export async function leaveTradingGroup(): Promise<GroupActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "unauthenticated" };

  const membership = await prisma.tradingGroupMember.findUnique({
    where: { userId: user.id },
    select: { id: true, role: true },
  });

  if (!membership) return { error: "not_in_group" };
  if (membership.role === "owner") return { error: "owner_must_delete" };

  await prisma.tradingGroupMember.delete({
    where: { id: membership.id },
  });

  revalidateGroupPages();
  return {};
}

export async function deleteTradingGroup(): Promise<GroupActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "unauthenticated" };

  const group = await prisma.tradingGroup.findUnique({
    where: { ownerId: user.id },
    select: { id: true },
  });

  if (!group) return { error: "not_group_owner" };

  await prisma.tradingGroup.delete({
    where: { id: group.id },
  });

  revalidateGroupPages();
  return {};
}

export async function renameTradingGroup(
  input: z.infer<typeof groupNameSchema>,
): Promise<GroupActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "unauthenticated" };

  const parsed = groupNameSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_name" };

  const updated = await prisma.tradingGroup.updateMany({
    where: { ownerId: user.id },
    data: { name: parsed.data.name },
  });

  if (updated.count === 0) return { error: "not_group_owner" };

  revalidateGroupPages();
  return {};
}

export async function regenerateTradingGroupCode(): Promise<GroupActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "unauthenticated" };

  const group = await prisma.tradingGroup.findUnique({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!group) return { error: "not_group_owner" };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await prisma.tradingGroup.update({
        where: { id: group.id },
        data: { code: generateTradingGroupCode() },
      });

      revalidateGroupPages();
      return {};
    } catch (error) {
      if (isUniqueConflict(error, "code")) continue;
      console.error("[groups] regenerate code failed", error);
      return { error: "unknown" };
    }
  }

  return { error: "code_generation_failed" };
}

export async function removeTradingGroupMember(
  input: z.infer<typeof userIdSchema>,
): Promise<GroupActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "unauthenticated" };

  const parsed = userIdSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_user" };
  if (parsed.data.userId === user.id) return { error: "owner_must_delete" };

  const group = await prisma.tradingGroup.findUnique({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!group) return { error: "not_group_owner" };

  const removed = await prisma.tradingGroupMember.deleteMany({
    where: {
      groupId: group.id,
      userId: parsed.data.userId,
      role: "member",
    },
  });

  if (removed.count === 0) return { error: "member_not_found" };

  revalidateGroupPages();
  return {};
}

export async function setGroupStakeVisibility(input: {
  showStakeAmounts: boolean;
}): Promise<GroupActionResult> {
  const user = await getAuthUser();
  if (!user) return { error: "unauthenticated" };

  const updated = await prisma.tradingGroupMember.updateMany({
    where: { userId: user.id },
    data: { showStakeAmounts: input.showStakeAmounts },
  });

  if (updated.count === 0) return { error: "not_in_group" };

  revalidateGroupPages();
  return {};
}
