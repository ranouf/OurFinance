/** Group references are only valid within their own Firestore path. */
export interface Group {
  readonly id: string;
  readonly name: string;
  readonly currency: string;
  readonly ownerId: string;
  readonly currencyLocked?: boolean;
  readonly memberCount?: number;
  readonly status: 'active' | 'archived';
}

export interface GroupMember {
  readonly userId: string;
  readonly role: 'owner' | 'member';
  readonly status: 'active' | 'revoked';
}

export interface InvitationRequest {
  readonly groupId: string;
  readonly targetEmail?: string;
  readonly expiresAt: string;
}
