import { bearerToken, verifyFirebaseIdToken, verifyFirebaseVerifiedEmail, verifyFirebaseVerifiedIdentity } from './auth';
import { createGroup } from './groups';
import { changeGroupCurrency, GroupCurrencyError } from './group-currency';
import { createExpense, ExpenseError, mutateExpense } from './expenses';
import { handleMedia } from './media';
import { MediaDiagnosticError } from './media-diagnostic';
import type { CloudinaryEnv } from './cloudinary';
import { readMember } from './firestore';
import { readLimitedJson, RequestBodyError } from './request-body';
import { acceptInvitation, createInvitation, InvitationError } from './invitations';
import { acceptQrInvitation, createQrInvitation, previewQrInvitation, revokeQrInvitation, QrInvitationError } from './qr-invitations';
import { createSettlement, SettlementError } from './settlements';
import { createImportBatch, undoImportBatch, ImportError } from './import-batches';
import { writeCategory, CategoryError } from './custom-categories';
import { createComment, CommentError } from './comments';
import { collectBackupPreferences, BackupPreferencesError } from './backup-preferences';
import { collectBackupSnapshotV2, BackupSnapshotError } from './backup-snapshot';
import { decodeBackupZipV2 } from '../../../src/app/features/import-export/backup-zip-read';
import { restoreGroupFromPackage, RestoreOrchestrationError } from './restore-orchestrator';
import { abortRestoreLock, RestoreLockError } from './restore-lock';
import { retryRestoreCleanup, RestoreCleanupError } from './restore-cleanup';
import { readLimitedBody } from './media';
import { collectLiveRestoreInventory, RestoreInventoryError } from './restore-inventory';
import { summarizeRestorePreviewV2 } from './restore-preview';

export interface Env extends Partial<CloudinaryEnv> {
  FIREBASE_PROJECT_ID: string;
  ALLOWED_ORIGIN: string;
  FIREBASE_SERVICE_ACCOUNT_JSON?: string;
  ENABLE_GROUP_CREATION?: string;
  ENABLE_GROUP_CURRENCY_POC?: string;
  GROUP_CURRENCY_POC_GROUP_ID?: string;
  ENABLE_MEDIA_POC?: string;
  ENABLE_EXPENSE_POC?: string;
  EXPENSE_POC_GROUP_ID?: string;
  MEDIA_POC_GROUP_ID?: string;
  ENABLE_INVITATION_POC?: string;
  INVITATION_POC_GROUP_ID?: string;
  ENABLE_QR_INVITATION_POC?: string;
  QR_INVITATION_POC_GROUP_ID?: string;
  ENABLE_SETTLEMENT_POC?: string;
  SETTLEMENT_POC_GROUP_ID?: string;
  ENABLE_IMPORT_POC?: string;
  IMPORT_POC_GROUP_ID?: string;
  ENABLE_CATEGORY_POC?: string;
  CATEGORY_POC_GROUP_ID?: string;
  ENABLE_COMMENT_POC?: string;
  COMMENT_POC_GROUP_ID?: string;
  ENABLE_BACKUP_POC?: string;
  BACKUP_POC_GROUP_ID?: string;
  ENABLE_RESTORE_POC?: string;
  RESTORE_POC_GROUP_ID?: string;
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  headers.set('Referrer-Policy', 'no-referrer');
  if (origin && origin !== env.ALLOWED_ORIGIN) return new Response(JSON.stringify({ error: 'Origine refusée' }), { status: 403, headers });
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
  if (request.method === 'OPTIONS') {
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    return new Response(null, { status: 204, headers });
  }
  const url = new URL(request.url);
  if (url.pathname === '/health' && request.method === 'GET') return new Response(JSON.stringify({ status: 'ok' }), { headers });
  const restorePreviewMatch = /^\/groups\/([A-Za-z0-9_-]{1,128})\/backup\/preview$/.exec(url.pathname);
  if (restorePreviewMatch && request.method === 'POST') {
    const groupId = restorePreviewMatch[1];
    if (env.ENABLE_RESTORE_POC !== 'true' || env.RESTORE_POC_GROUP_ID !== groupId || !env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      return new Response(JSON.stringify({ error: 'Restauration non configurée' }), { status: 503, headers });
    }
    let uid: string;
    try { uid = await verifyFirebaseVerifiedEmail(bearerToken(request), env.FIREBASE_PROJECT_ID); }
    catch { return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401, headers }); }
    if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/zip' ||
        Number(request.headers.get('Content-Length') ?? 0) > 20_000_000) {
      return new Response(JSON.stringify({ error: 'Archive invalide ou trop volumineuse' }), { status: 413, headers });
    }
    let bytes: Uint8Array;
    try { bytes = await readLimitedBody(request, 20_000_000); }
    catch { return new Response(JSON.stringify({ error: 'Archive absente ou trop volumineuse' }), { status: 413, headers }); }
    let archive;
    try { archive = await decodeBackupZipV2(bytes); }
    catch { return new Response(JSON.stringify({ error: 'Archive invalide' }), { status: 400, headers }); }
    try {
      const live = await collectLiveRestoreInventory(uid, groupId,
        { FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON: env.FIREBASE_SERVICE_ACCOUNT_JSON });
      const counts = await summarizeRestorePreviewV2(archive, groupId, live);
      return new Response(JSON.stringify(counts), { status: 200, headers });
    } catch (error) {
      const status = error instanceof RestoreInventoryError ? error.status : 400;
      return new Response(JSON.stringify({ error: error instanceof RestoreInventoryError ? error.code : 'invalid_backup' }), { status, headers });
    }
  }
  const restoreMatch = /^\/groups\/([A-Za-z0-9_-]{1,128})\/backup\/restores\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})(?:\/(cleanup))?$/.exec(url.pathname);
  if (restoreMatch && (request.method === 'POST' || request.method === 'DELETE')) {
    const [groupId, restoreId, suffix] = restoreMatch.slice(1);
    if (env.ENABLE_RESTORE_POC !== 'true' || env.RESTORE_POC_GROUP_ID !== groupId || !env.FIREBASE_SERVICE_ACCOUNT_JSON ||
        !env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      return new Response(JSON.stringify({ error: 'Restauration non configurée' }), { status: 503, headers });
    }
    let uid: string;
    try { uid = await verifyFirebaseVerifiedEmail(bearerToken(request), env.FIREBASE_PROJECT_ID); }
    catch { return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401, headers }); }
    const restoreEnv = { FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON: env.FIREBASE_SERVICE_ACCOUNT_JSON,
      CLOUDINARY_CLOUD_NAME: env.CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY: env.CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET: env.CLOUDINARY_API_SECRET };
    try {
      if (request.method === 'POST' && !suffix) {
        if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/zip' ||
            Number(request.headers.get('Content-Length') ?? 0) > 20_000_000) return new Response(JSON.stringify({ error: 'Archive invalide ou trop volumineuse' }), { status: 413, headers });
        let bytes: Uint8Array;
        try { bytes = await readLimitedBody(request, 20_000_000); }
        catch { return new Response(JSON.stringify({ error: 'Archive absente ou trop volumineuse' }), { status: 413, headers }); }
        let archive;
        try { archive = await decodeBackupZipV2(bytes); }
        catch { return new Response(JSON.stringify({ error: 'Archive invalide' }), { status: 400, headers }); }
        const result = await restoreGroupFromPackage(uid, groupId, restoreId, archive, restoreEnv);
        return new Response(JSON.stringify(result), { status: result.cleanupPending ? 202 : 200, headers });
      }
      if (request.method === 'DELETE' && !suffix) {
        await abortRestoreLock(uid, groupId, restoreId, restoreEnv);
        try { await retryRestoreCleanup(uid, groupId, restoreId, restoreEnv); return new Response(null, { status: 204, headers }); }
        catch { return new Response(JSON.stringify({ restoreId, cleanupPending: true }), { status: 202, headers }); }
      }
      if (request.method === 'POST' && suffix === 'cleanup') {
        await retryRestoreCleanup(uid, groupId, restoreId, restoreEnv);
        return new Response(null, { status: 204, headers });
      }
      return new Response(JSON.stringify({ error: 'Méthode non prise en charge' }), { status: 405, headers });
    } catch (error) {
      const status = error instanceof RestoreOrchestrationError ? error.code === 'invalid_backup' ? 400 : 503 :
        error instanceof RestoreLockError || error instanceof RestoreCleanupError ? error.status : 503;
      const code = error instanceof RestoreOrchestrationError || error instanceof RestoreLockError || error instanceof RestoreCleanupError
        ? error.code : 'restore_unavailable';
      return new Response(JSON.stringify({ error: code }), { status, headers });
    }
  }
  const backupPreferencesMatch = /^\/groups\/([A-Za-z0-9_-]{1,128})\/backup\/preferences$/.exec(url.pathname);
  const backupSnapshotMatch = /^\/groups\/([A-Za-z0-9_-]{1,128})\/backup\/snapshot$/.exec(url.pathname);
  if (backupSnapshotMatch && request.method === 'GET') {
    if (env.ENABLE_BACKUP_POC !== 'true' || env.BACKUP_POC_GROUP_ID !== backupSnapshotMatch[1] || !env.FIREBASE_SERVICE_ACCOUNT_JSON) return new Response(JSON.stringify({ error: 'Sauvegarde non configurée' }), { status: 503, headers });
    let uid: string;
    try { uid = await verifyFirebaseVerifiedEmail(bearerToken(request), env.FIREBASE_PROJECT_ID); }
    catch { return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401, headers }); }
    try {
      const snapshot = await collectBackupSnapshotV2(uid, backupSnapshotMatch[1], { FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON: env.FIREBASE_SERVICE_ACCOUNT_JSON });
      if (new TextEncoder().encode(snapshot).byteLength > 10_000_000) return new Response(JSON.stringify({ error: 'Sauvegarde trop volumineuse' }), { status: 413, headers });
      return new Response(snapshot, { status: 200, headers });
    } catch (error) {
      const status = error instanceof BackupSnapshotError ? error.status : 503;
      const code = error instanceof BackupSnapshotError ? error.code : 'backup_unavailable';
      return new Response(JSON.stringify({ error: code }), { status, headers });
    }
  }
  if (backupPreferencesMatch && request.method === 'GET') {
    if (env.ENABLE_BACKUP_POC !== 'true' || env.BACKUP_POC_GROUP_ID !== backupPreferencesMatch[1] || !env.FIREBASE_SERVICE_ACCOUNT_JSON) return new Response(JSON.stringify({ error: 'Sauvegarde non configurée' }), { status: 503, headers });
    let uid: string;
    try { uid = await verifyFirebaseVerifiedEmail(bearerToken(request), env.FIREBASE_PROJECT_ID); }
    catch { return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401, headers }); }
    try {
      const preferences = await collectBackupPreferences(uid, backupPreferencesMatch[1], { FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON: env.FIREBASE_SERVICE_ACCOUNT_JSON });
      return new Response(JSON.stringify({ preferences }), { status: 200, headers });
    } catch (error) {
      const status = error instanceof BackupPreferencesError ? error.status : 503;
      const code = error instanceof BackupPreferencesError ? error.code : 'backup_unavailable';
      return new Response(JSON.stringify({ error: code }), { status, headers });
    }
  }
  const commentMatch = /^\/groups\/([A-Za-z0-9_-]{1,128})\/expenses\/([A-Za-z0-9_-]{1,128})\/comments$/.exec(url.pathname);
  if (commentMatch && request.method === 'POST') {
    if (env.ENABLE_COMMENT_POC !== 'true' || env.COMMENT_POC_GROUP_ID !== commentMatch[1] || !env.FIREBASE_SERVICE_ACCOUNT_JSON) return new Response(JSON.stringify({ error: 'Commentaires non configurés' }), { status: 503, headers });
    let uid: string;
    try { uid = await verifyFirebaseVerifiedEmail(bearerToken(request), env.FIREBASE_PROJECT_ID); }
    catch { return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401, headers }); }
    try {
      const body = await readLimitedJson(request, 2048);
      const commentId = await createComment(body, uid, commentMatch[1], commentMatch[2], { FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON: env.FIREBASE_SERVICE_ACCOUNT_JSON });
      return new Response(JSON.stringify({ commentId }), { status: 201, headers });
    } catch (error) {
      const status = error instanceof CommentError ? error.status : error instanceof RequestBodyError ? 400 : 503;
      const code = error instanceof CommentError || error instanceof RequestBodyError ? error.code : 'comment_unavailable';
      return new Response(JSON.stringify({ error: code }), { status, headers });
    }
  }
  const categoryCreate = /^\/groups\/([A-Za-z0-9_-]{1,128})\/categories$/.exec(url.pathname);
  const categoryUpdate = /^\/groups\/([A-Za-z0-9_-]{1,128})\/categories\/(custom_[0-9a-f-]{36})$/.exec(url.pathname);
  if ((categoryCreate && request.method === 'POST') || (categoryUpdate && request.method === 'PATCH')) {
    const groupId = (categoryCreate ?? categoryUpdate)![1];
    if (env.ENABLE_CATEGORY_POC !== 'true' || env.CATEGORY_POC_GROUP_ID !== groupId || !env.FIREBASE_SERVICE_ACCOUNT_JSON) return new Response(JSON.stringify({ error: 'Catégories non configurées' }), { status: 503, headers });
    let uid: string;
    try { uid = await verifyFirebaseVerifiedEmail(bearerToken(request), env.FIREBASE_PROJECT_ID); }
    catch { return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401, headers }); }
    try {
      const body = await readLimitedJson(request, 2048) as Record<string, unknown>;
      const categoryId = categoryCreate ? body['categoryId'] : categoryUpdate![2];
      const id = await writeCategory(body, uid, groupId, String(categoryId), categoryCreate ? 'create' : 'update', { FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON: env.FIREBASE_SERVICE_ACCOUNT_JSON });
      return new Response(JSON.stringify({ categoryId: id }), { status: categoryCreate ? 201 : 200, headers });
    } catch (error) {
      const status = error instanceof CategoryError ? error.status : error instanceof RequestBodyError ? 400 : 503;
      const code = error instanceof CategoryError || error instanceof RequestBodyError ? error.code : 'category_unavailable';
      return new Response(JSON.stringify({ error: code }), { status, headers });
    }
  }
  const importCreate = /^\/groups\/([A-Za-z0-9_-]{1,128})\/imports$/.exec(url.pathname);
  const importUndo = /^\/groups\/([A-Za-z0-9_-]{1,128})\/imports\/([A-Za-z0-9_-]{1,128})$/.exec(url.pathname);
  if ((importCreate && request.method === 'POST') || (importUndo && request.method === 'DELETE')) {
    const groupId = (importCreate ?? importUndo)![1];
    if (env.ENABLE_IMPORT_POC !== 'true' || env.IMPORT_POC_GROUP_ID !== groupId || !env.FIREBASE_SERVICE_ACCOUNT_JSON) return new Response(JSON.stringify({ error: 'Import non configuré' }), { status: 503, headers });
    let uid: string;
    try { uid = await verifyFirebaseVerifiedEmail(bearerToken(request), env.FIREBASE_PROJECT_ID); }
    catch { return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401, headers }); }
    try {
      const importEnv = { FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON: env.FIREBASE_SERVICE_ACCOUNT_JSON };
      if (importCreate) {
        const body = await readLimitedJson(request, 16384);
        const result = await createImportBatch(body, uid, groupId, importEnv);
        return new Response(JSON.stringify(result), { status: 201, headers });
      }
      await undoImportBatch(importUndo![2], uid, groupId, importEnv);
      return new Response(null, { status: 204, headers });
    } catch (error) {
      const status = error instanceof ImportError ? error.status : error instanceof RequestBodyError ? 400 : 503;
      const code = error instanceof ImportError || error instanceof RequestBodyError ? error.code : 'import_unavailable';
      return new Response(JSON.stringify({ error: code }), { status, headers });
    }
  }
  const settlementMatch = /^\/groups\/([A-Za-z0-9_-]{1,128})\/settlements$/.exec(url.pathname);
  if (settlementMatch && request.method === 'POST') {
    if (env.ENABLE_SETTLEMENT_POC !== 'true' || env.SETTLEMENT_POC_GROUP_ID !== settlementMatch[1] || !env.FIREBASE_SERVICE_ACCOUNT_JSON) return new Response(JSON.stringify({ error: 'Règlements non configurés' }), { status: 503, headers });
    let uid: string;
    try { uid = await verifyFirebaseVerifiedEmail(bearerToken(request), env.FIREBASE_PROJECT_ID); }
    catch { return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401, headers }); }
    try {
      const body = await readLimitedJson(request, 2048);
      const settlementId = await createSettlement(body, uid, settlementMatch[1], { FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON: env.FIREBASE_SERVICE_ACCOUNT_JSON });
      return new Response(JSON.stringify({ settlementId }), { status: 201, headers });
    } catch (error) {
      const status = error instanceof SettlementError ? error.status : error instanceof RequestBodyError ? 400 : 503;
      const code = error instanceof SettlementError || error instanceof RequestBodyError ? error.code : 'settlement_unavailable';
      return new Response(JSON.stringify({ error: code }), { status, headers });
    }
  }
  const qrCreate = /^\/groups\/([A-Za-z0-9_-]{1,128})\/qr-invitations$/.exec(url.pathname);
  const qrRevoke = /^\/groups\/([A-Za-z0-9_-]{1,128})\/qr-invitations\/([A-Za-z0-9_-]{1,128})\/revoke$/.exec(url.pathname);
  if (request.method === 'POST' && (qrCreate || qrRevoke || url.pathname === '/qr-invitations/preview' || url.pathname === '/qr-invitations/accept')) {
    if (env.ENABLE_QR_INVITATION_POC !== 'true' || !env.QR_INVITATION_POC_GROUP_ID || !env.FIREBASE_SERVICE_ACCOUNT_JSON) return new Response(JSON.stringify({ error: 'Invitations QR non configurées' }), { status: 503, headers });
    let identity: { uid: string; email: string };
    try { identity = await verifyFirebaseVerifiedIdentity(bearerToken(request), env.FIREBASE_PROJECT_ID); }
    catch { return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401, headers }); }
    const qrEnv = { FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON: env.FIREBASE_SERVICE_ACCOUNT_JSON, QR_INVITATION_POC_GROUP_ID: env.QR_INVITATION_POC_GROUP_ID };
    try {
      if (qrRevoke) {
        await revokeQrInvitation(qrRevoke[2], identity.uid, qrRevoke[1], qrEnv);
        return new Response(null, { status: 204, headers });
      }
      const body = await readLimitedJson(request, 1024);
      if (!body || typeof body !== 'object') throw new QrInvitationError(400, 'invalid_invitation');
      if (qrCreate) {
        const created = await createQrInvitation(body, identity.uid, qrCreate[1], qrEnv);
        const link = new URL('/join', env.ALLOWED_ORIGIN);
        if (link.protocol !== 'https:') throw new QrInvitationError(503, 'origin_unavailable');
        link.hash = new URLSearchParams({ invite: created.token }).toString();
        return new Response(JSON.stringify({ invitationId: created.invitationId, link: link.toString(), expiresAt: created.expiresAt }), { status: 201, headers });
      }
      const token = (body as Record<string, unknown>)['token'];
      if (url.pathname === '/qr-invitations/preview') {
        const preview = await previewQrInvitation(token, identity.uid, identity.email, qrEnv);
        return new Response(JSON.stringify(preview), { status: 200, headers });
      }
      const groupId = await acceptQrInvitation(token, identity.uid, identity.email, qrEnv);
      return new Response(JSON.stringify({ groupId }), { status: 200, headers });
    } catch (error) {
      const status = error instanceof QrInvitationError ? error.status : error instanceof RequestBodyError ? 400 : 503;
      const code = error instanceof QrInvitationError || error instanceof RequestBodyError ? error.code : 'invitation_unavailable';
      return new Response(JSON.stringify({ error: code }), { status, headers });
    }
  }
  const inviteCreate = /^\/groups\/([A-Za-z0-9_-]{1,128})\/invitations$/.exec(url.pathname);
  const inviteAccept = /^\/groups\/([A-Za-z0-9_-]{1,128})\/invitations\/([A-Za-z0-9_-]{1,128})\/accept$/.exec(url.pathname);
  if (request.method === 'POST' && (inviteCreate || inviteAccept)) {
    const groupId = (inviteCreate ?? inviteAccept)![1];
    if (env.ENABLE_INVITATION_POC !== 'true' || env.INVITATION_POC_GROUP_ID !== groupId || !env.FIREBASE_SERVICE_ACCOUNT_JSON) return new Response(JSON.stringify({ error: 'Invitations non configurées' }), { status: 503, headers });
    let identity: { uid: string; email: string };
    try { identity = await verifyFirebaseVerifiedIdentity(bearerToken(request), env.FIREBASE_PROJECT_ID); }
    catch { return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401, headers }); }
    try {
      const body = await readLimitedJson(request, 1024);
      if (!body || typeof body !== 'object') throw new InvitationError(400, 'invalid_invitation');
      if (inviteCreate) {
        const result = await createInvitation(body, identity.uid, groupId, { FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON: env.FIREBASE_SERVICE_ACCOUNT_JSON });
        return new Response(JSON.stringify(result), { status: 201, headers });
      }
      await acceptInvitation((body as Record<string, unknown>)['token'], inviteAccept![2], identity.uid, identity.email, groupId, { FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON: env.FIREBASE_SERVICE_ACCOUNT_JSON });
      return new Response(null, { status: 204, headers });
    } catch (error) {
      const status = error instanceof InvitationError ? error.status : error instanceof RequestBodyError ? 400 : 503;
      const code = error instanceof InvitationError || error instanceof RequestBodyError ? error.code : 'invitation_unavailable';
      return new Response(JSON.stringify({ error: code }), { status, headers });
    }
  }
  const mediaMatch = /^\/groups\/([A-Za-z0-9_-]{1,128})\/expenses\/([A-Za-z0-9_-]{1,128})\/attachments(?:\/([A-Za-z0-9_-]{1,128}))?$/.exec(url.pathname);
  if (mediaMatch && ((request.method === 'POST' && !mediaMatch[3]) || ((request.method === 'GET' || request.method === 'DELETE') && !!mediaMatch[3]))) {
    if (env.ENABLE_MEDIA_POC !== 'true' || !env.MEDIA_POC_GROUP_ID || env.MEDIA_POC_GROUP_ID !== mediaMatch[1] || !env.FIREBASE_SERVICE_ACCOUNT_JSON || !env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) return new Response(JSON.stringify({ error: 'Médias non configurés' }), { status: 503, headers });
    try { return await handleMedia(request, { groupId: mediaMatch[1], expenseId: mediaMatch[2], attachmentId: mediaMatch[3] }, env as Required<Env>, headers); }
    catch (error) { return new Response(JSON.stringify({ error: 'Média indisponible', code: error instanceof MediaDiagnosticError ? error.code : 'internal' }), { status: 502, headers }); }
  }
  const expenseMatch = /^\/groups\/([A-Za-z0-9_-]{1,128})\/expenses$/.exec(url.pathname);
  const expenseItemMatch = /^\/groups\/([A-Za-z0-9_-]{1,128})\/expenses\/([A-Za-z0-9_-]{1,128})$/.exec(url.pathname);
  if (expenseItemMatch && (request.method === 'PATCH' || request.method === 'DELETE')) {
    if (env.ENABLE_EXPENSE_POC !== 'true' || env.EXPENSE_POC_GROUP_ID !== expenseItemMatch[1] || !env.FIREBASE_SERVICE_ACCOUNT_JSON) return new Response(JSON.stringify({ error: 'Dépenses non configurées' }), { status: 503, headers });
    let uid: string;
    try { uid = await verifyFirebaseVerifiedEmail(bearerToken(request), env.FIREBASE_PROJECT_ID); }
    catch { return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401, headers }); }
    try {
      const body = await readLimitedJson(request, request.method === 'PATCH' ? 8192 : 256);
      await mutateExpense(body, uid, expenseItemMatch[1], expenseItemMatch[2], request.method, env as Required<Env>);
      return new Response(null, { status: 204, headers });
    } catch (error) {
      const status = error instanceof ExpenseError ? error.status : error instanceof RequestBodyError ? 400 : 503;
      const code = error instanceof ExpenseError || error instanceof RequestBodyError ? error.code : 'expense_unavailable';
      return new Response(JSON.stringify({ error: code }), { status, headers });
    }
  }
  if (expenseMatch && request.method === 'POST') {
    if (env.ENABLE_EXPENSE_POC !== 'true' || env.EXPENSE_POC_GROUP_ID !== expenseMatch[1] || !env.FIREBASE_SERVICE_ACCOUNT_JSON) return new Response(JSON.stringify({ error: 'Dépenses non configurées' }), { status: 503, headers });
    let uid: string;
    try { uid = await verifyFirebaseVerifiedEmail(bearerToken(request), env.FIREBASE_PROJECT_ID); }
    catch { return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401, headers }); }
    try {
      const body = await readLimitedJson(request, 8192);
      const expenseId = await createExpense(body, uid, expenseMatch[1], { FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON: env.FIREBASE_SERVICE_ACCOUNT_JSON });
      return new Response(JSON.stringify({ expenseId }), { status: 201, headers });
    } catch (error) {
      const status = error instanceof ExpenseError ? error.status : error instanceof RequestBodyError ? 400 : 503;
      const code = error instanceof ExpenseError || error instanceof RequestBodyError ? error.code : 'expense_unavailable';
      return new Response(JSON.stringify({ error: code }), { status, headers });
    }
  }
  if (url.pathname === '/groups' && request.method === 'POST') {
    if (!env.FIREBASE_SERVICE_ACCOUNT_JSON || env.ENABLE_GROUP_CREATION !== 'true') return new Response(JSON.stringify({ error: 'Création non configurée' }), { status: 503, headers });
    try {
      const token = bearerToken(request);
      const uid = await verifyFirebaseVerifiedEmail(token, env.FIREBASE_PROJECT_ID);
      const body = await readLimitedJson(request, 4096);
      const groupId = await createGroup(body, uid, { FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON: env.FIREBASE_SERVICE_ACCOUNT_JSON });
      return new Response(JSON.stringify({ groupId }), { status: 201, headers });
    } catch { return new Response(JSON.stringify({ error: 'Création impossible' }), { status: 400, headers }); }
  }
  const currencyMatch = /^\/groups\/([A-Za-z0-9_-]{1,128})\/currency$/.exec(url.pathname);
  if (currencyMatch && request.method === 'PATCH') {
    if (env.ENABLE_GROUP_CURRENCY_POC !== 'true' || env.GROUP_CURRENCY_POC_GROUP_ID !== currencyMatch[1] || !env.FIREBASE_SERVICE_ACCOUNT_JSON) return new Response(JSON.stringify({ error: 'Modification non configurée' }), { status: 503, headers });
    let uid: string;
    try { uid = await verifyFirebaseVerifiedEmail(bearerToken(request), env.FIREBASE_PROJECT_ID); }
    catch { return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401, headers }); }
    try {
      const body = await readLimitedJson(request, 256);
      await changeGroupCurrency(body, uid, currencyMatch[1], { FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON: env.FIREBASE_SERVICE_ACCOUNT_JSON });
      return new Response(null, { status: 204, headers });
    } catch (error) {
      const status = error instanceof GroupCurrencyError ? error.status : error instanceof RequestBodyError ? 400 : 503;
      const code = error instanceof GroupCurrencyError || error instanceof RequestBodyError ? error.code : 'currency_unavailable';
      return new Response(JSON.stringify({ error: code }), { status, headers });
    }
  }
  const match = /^\/groups\/([A-Za-z0-9_-]{1,128})\/access$/.exec(url.pathname);
  if (!match || request.method !== 'GET') return new Response(JSON.stringify({ error: 'Route inconnue' }), { status: 404, headers });
  try {
    const token = bearerToken(request);
    const uid = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
    const member = await readMember(env.FIREBASE_PROJECT_ID, match[1], uid, token);
    if (!member || member.status !== 'active') return new Response(JSON.stringify({ error: 'Accès refusé' }), { status: 403, headers });
    return new Response(JSON.stringify({ groupId: match[1], role: member.role }), { headers });
  } catch {
    return new Response(JSON.stringify({ error: 'Authentification ou service indisponible' }), { status: 401, headers });
  }
}

export default { fetch: handleRequest };
