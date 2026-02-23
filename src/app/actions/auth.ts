'use server'

import { createServerClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

type ActionResult = { error?: string; code?: string; success?: boolean } | null

export async function signInWithEmail(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email y contraseña son requeridos', code: 'MISSING_FIELDS' }
  }

  const supabase = createServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Email o contraseña incorrectos', code: 'INVALID_CREDENTIALS' }
  }

  redirect('/dashboard')
}

export async function signUpWithEmail(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = (formData.get('name') as string | null) || undefined

  if (!email || !password) {
    return { error: 'Email y contraseña son requeridos', code: 'MISSING_FIELDS' }
  }

  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres', code: 'WEAK_PASSWORD' }
  }

  const supabase = createServerClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      data: { full_name: name },
    },
  })

  if (error) {
    if (error.message.includes('already registered')) {
      return { error: 'Este email ya está registrado', code: 'EMAIL_EXISTS' }
    }
    return { error: error.message, code: 'SIGNUP_ERROR' }
  }

  // If email confirmation is disabled, session is created immediately
  if (data.session) {
    await prisma.user.upsert({
      where: { supabaseId: data.user!.id },
      create: {
        supabaseId: data.user!.id,
        email,
        name: name ?? null,
      },
      update: { name: name ?? undefined },
    })
    redirect('/dashboard')
  }

  // Email confirmation required — show verify page
  return { success: true }
}

export async function signOut(): Promise<void> {
  const supabase = createServerClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/auth/login')
}
