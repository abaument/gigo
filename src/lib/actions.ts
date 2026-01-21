/**
 * Server actions for GIGO V1.
 *
 * Provides type-safe server-side functions for adapters, authentication,
 * and schema generation. All actions verify user authentication.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from './db';
import { createClient } from './supabase/server';
import { encrypt, decrypt, maskSensitive } from './encryption';
import { generateSchemaFromDocs, generateSchemaFromUrl } from './schema-generator';

// =============================================================================
// AUTHENTICATION HELPERS
// =============================================================================

/**
 * Get the currently authenticated user.
 *
 * Returns
 * -------
 * User or null
 *     The authenticated user or null if not logged in.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  // Ensure user exists in our database
  let dbUser = await db.user.findUnique({
    where: { id: user.id },
  });

  if (!dbUser) {
    // Create user record on first login
    dbUser = await db.user.create({
      data: {
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.full_name || user.email?.split('@')[0],
        avatarUrl: user.user_metadata?.avatar_url,
      },
    });
  }

  return dbUser;
}

/**
 * Require authentication - redirects to login if not authenticated.
 *
 * Returns
 * -------
 * User
 *     The authenticated user.
 *
 * Raises
 * ------
 * Redirect
 *     Redirects to /login if not authenticated.
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

// =============================================================================
// AUTH ACTIONS
// =============================================================================

/**
 * Sign up a new user with email and password.
 */
export async function signUp(formData: FormData) {
  const supabase = await createClient();
  
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      },
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true, data };
}

/**
 * Sign in with email and password.
 */
export async function signIn(formData: FormData) {
  const supabase = await createClient();
  
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

// =============================================================================
// ADAPTER ACTIONS
// =============================================================================

interface CreateAdapterInput {
  name: string;
  description?: string;
  targetSchema: string;
  schemaSourceType?: string;
  schemaSourceUrl?: string;
  destinationUrl?: string;
  authMethod?: string;
  authHeaderName?: string;
  authValue?: string;
}

/**
 * Create a new adapter for the authenticated user.
 */
export async function createAdapter(input: CreateAdapterInput) {
  try {
    const user = await requireAuth();

    // Validate JSON schema
    try {
      JSON.parse(input.targetSchema);
    } catch {
      return { success: false as const, error: 'Invalid JSON in target schema' };
    }

    // Encrypt auth value if provided
    let encryptedAuthValue: string | null = null;
    if (input.authValue) {
      encryptedAuthValue = encrypt(input.authValue);
    }

    const adapter = await db.adapter.create({
      data: {
        userId: user.id,
        name: input.name,
        description: input.description || null,
        targetSchema: JSON.stringify(JSON.parse(input.targetSchema), null, 2),
        schemaSourceType: input.schemaSourceType || 'manual',
        schemaSourceUrl: input.schemaSourceUrl || null,
        destinationUrl: input.destinationUrl || null,
        authMethod: input.authMethod || 'none',
        authHeaderName: input.authHeaderName || null,
        encryptedAuthValue,
      },
    });

    revalidatePath('/');
    return { success: true as const, data: adapter };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create adapter';
    return { success: false as const, error: message };
  }
}

/**
 * Get all adapters for the authenticated user.
 */
export async function getAdapters(options?: { take?: number; skip?: number }) {
  const user = await getCurrentUser();
  if (!user) return [];

  const adapters = await db.adapter.findMany({
    where: { userId: user.id },
    take: options?.take ?? 50,
    skip: options?.skip ?? 0,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { logs: true },
      },
    },
  });

  return adapters;
}

/**
 * Get a single adapter by ID (with ownership verification).
 */
export async function getAdapterById(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  const adapter = await db.adapter.findFirst({
    where: { 
      id,
      userId: user.id, // Row-level security
    },
  });

  return adapter;
}

/**
 * Get adapter with masked credentials (for display).
 */
export async function getAdapterWithMaskedCredentials(id: string) {
  const adapter = await getAdapterById(id);
  if (!adapter) return null;

  return {
    ...adapter,
    maskedAuthValue: adapter.encryptedAuthValue 
      ? maskSensitive(decrypt(adapter.encryptedAuthValue))
      : null,
    encryptedAuthValue: undefined, // Don't expose encrypted value
  };
}

/**
 * Update an adapter.
 */
export async function updateAdapter(id: string, input: Partial<CreateAdapterInput>) {
  try {
    const user = await requireAuth();

    // Verify ownership
    const existing = await db.adapter.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return { success: false as const, error: 'Adapter not found' };
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    
    if (input.name) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.targetSchema) {
      try {
        JSON.parse(input.targetSchema);
        updateData.targetSchema = JSON.stringify(JSON.parse(input.targetSchema), null, 2);
      } catch {
        return { success: false as const, error: 'Invalid JSON in target schema' };
      }
    }
    if (input.schemaSourceType) updateData.schemaSourceType = input.schemaSourceType;
    if (input.schemaSourceUrl !== undefined) updateData.schemaSourceUrl = input.schemaSourceUrl;
    if (input.destinationUrl !== undefined) updateData.destinationUrl = input.destinationUrl;
    if (input.authMethod) updateData.authMethod = input.authMethod;
    if (input.authHeaderName !== undefined) updateData.authHeaderName = input.authHeaderName;
    if (input.authValue !== undefined) {
      updateData.encryptedAuthValue = input.authValue ? encrypt(input.authValue) : null;
    }

    const adapter = await db.adapter.update({
      where: { id },
      data: updateData,
    });

    revalidatePath('/');
    revalidatePath(`/adapters/${id}`);
    return { success: true as const, data: adapter };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update adapter';
    return { success: false as const, error: message };
  }
}

/**
 * Delete an adapter and all associated logs.
 */
export async function deleteAdapter(id: string) {
  try {
    const user = await requireAuth();

    // Verify ownership
    const existing = await db.adapter.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return { success: false as const, error: 'Adapter not found' };
    }

    await db.adapter.delete({
      where: { id },
    });

    revalidatePath('/');
    return { success: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete adapter';
    return { success: false as const, error: message };
  }
}

/**
 * Get transformation logs for an adapter.
 */
export async function getAdapterLogs(
  adapterId: string,
  options?: { take?: number; skip?: number }
) {
  const user = await getCurrentUser();
  if (!user) return [];

  // Verify ownership
  const adapter = await db.adapter.findFirst({
    where: { id: adapterId, userId: user.id },
  });

  if (!adapter) return [];

  const logs = await db.transformationLog.findMany({
    where: { adapterId },
    take: options?.take ?? 50,
    skip: options?.skip ?? 0,
    orderBy: { createdAt: 'desc' },
  });

  return logs;
}

// =============================================================================
// SCHEMA GENERATION ACTIONS
// =============================================================================

/**
 * Generate a schema from documentation text.
 */
export async function generateSchema(documentationText: string) {
  await requireAuth();
  return await generateSchemaFromDocs(documentationText);
}

/**
 * Generate a schema from a documentation URL.
 */
export async function generateSchemaFromDocUrl(url: string) {
  await requireAuth();
  return await generateSchemaFromUrl(url);
}
