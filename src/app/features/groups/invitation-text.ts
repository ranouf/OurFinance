import type { Language } from '../../shared/utils/i18n';

export const invitationText = {
  fr: {
    heading: 'Invitations', intro: 'Invitez une adresse confirmée et partagez le lien par un canal privé. Le lien est à usage unique et expire après 72 heures.',
    group: 'Groupe', chooseGroup: 'Choisir un groupe', recipient: 'Courriel du destinataire', create: 'Créer un lien',
    ready: 'Copiez ce lien maintenant. Il ne sera plus affiché après votre départ.', copy: 'Copier le lien',
    join: 'Rejoindre un groupe', code: 'Code d’invitation reçu', accept: 'Rejoindre le groupe',
    created: 'Lien créé. Transmettez-le au destinataire par un canal privé.', createFailed: 'Création de l’invitation impossible.',
    copied: 'Lien copié. Transmettez-le par un canal privé.', copyFailed: 'Copie impossible. Réessayez depuis un navigateur autorisant le presse-papiers.',
    received: 'Lien d’invitation reçu. Connectez-vous avec l’adresse invitée, puis rejoignez le groupe.',
    accepted: 'Invitation acceptée. Le groupe est maintenant disponible.', acceptFailed: 'Code invalide, expiré ou déjà utilisé.',
  },
  en: {
    heading: 'Invitations', intro: 'Invite a verified email address and share the link privately. The link can be used once and expires after 72 hours.',
    group: 'Group', chooseGroup: 'Choose a group', recipient: 'Recipient email', create: 'Create a link',
    ready: 'Copy this link now. It will not appear again after you leave.', copy: 'Copy link',
    join: 'Join a group', code: 'Invitation code', accept: 'Join group',
    created: 'Link created. Share it with the recipient privately.', createFailed: 'Could not create the invitation.',
    copied: 'Link copied. Share it privately.', copyFailed: 'Could not copy. Try a browser that allows clipboard access.',
    received: 'Invitation link received. Sign in with the invited address, then join the group.',
    accepted: 'Invitation accepted. The group is now available.', acceptFailed: 'Invalid, expired or already used code.',
  },
  ja: {
    heading: '招待', intro: '確認済みのメールアドレスを招待し、リンクを個別に共有してください。リンクは1回限りで、72時間後に期限切れになります。',
    group: 'グループ', chooseGroup: 'グループを選択', recipient: '招待先のメールアドレス', create: 'リンクを作成',
    ready: 'このリンクを今コピーしてください。画面を離れると再表示できません。', copy: 'リンクをコピー',
    join: 'グループに参加', code: '受け取った招待コード', accept: 'グループに参加',
    created: 'リンクを作成しました。招待先に個別に共有してください。', createFailed: '招待を作成できませんでした。',
    copied: 'リンクをコピーしました。個別に共有してください。', copyFailed: 'コピーできませんでした。クリップボードを許可するブラウザーをお試しください。',
    received: '招待リンクを受け取りました。招待されたメールアドレスでログインして参加してください。',
    accepted: '招待を承認しました。グループを利用できます。', acceptFailed: 'コードが無効、期限切れ、または使用済みです。',
  },
} as const satisfies Record<Language, Record<string, string>>;
