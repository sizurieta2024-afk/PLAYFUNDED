import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

const prisma = new PrismaClient();

async function ensureBucket(name) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;

  if (!buckets?.some((bucket) => bucket.name === name)) {
    const { error: createError } = await supabase.storage.createBucket(name, {
      public: false,
      fileSizeLimit: "10MB",
      allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"],
    });
    if (createError) throw createError;
  }
}

const stamp = Date.now();
const email = `kyc-scan-test+${stamp}@playfunded.local`;
const password = "PlayfundedTest!123";

try {
  await ensureBucket("kyc-quarantine");

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "KYC Scan Test" },
  });
  if (error) throw error;

  await prisma.user.upsert({
    where: { supabaseId: data.user.id },
    create: {
      supabaseId: data.user.id,
      email,
      name: "KYC Scan Test",
      country: "ES",
    },
    update: {
      email,
      name: "KYC Scan Test",
      country: "ES",
    },
  });

  console.log(JSON.stringify({ email, password, supabaseId: data.user.id }));
} finally {
  await prisma.$disconnect();
}
