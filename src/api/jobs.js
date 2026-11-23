// Change Django job fields into the fields used by the existing job cards.

export function toUiJob(row) {
  const when = Date.parse(row.created_at || '') || Date.now();
  return {
    id: `api-${row.id}`,
    apiId: row.id,
    ownerId: row.owner_id,
    isDemo: !!row.is_demo,
    externalOnly: !row.owner_id && !row.is_demo,
    externalUrl: row.external_url || '',
    title: row.title,
    description: row.description,
    category: row.category,
    clientName: row.client_name,
    clientCountry: row.client_country || 'Not specified',
    clientType: 'Client listing',
    skillsRequired: Array.isArray(row.required_skills) ? row.required_skills : [],
    budgetUSD: Number(row.budget_usd),
    budgetType: row.budget_type,
    beginnerFriendly: row.beginner_friendly,
    paymentVerified: row.payment_verified,
    postedHoursAgo: Math.max(0, Math.floor((Date.now() - when) / 3600000)),
    applicants: 0,
    aboutClient: row.moderation_label || 'This listing is published in Vouch. Payment details have not been independently verified.',
    jobsPostedByClient: 0,
    hireRate: 0,
    memberSince: new Date(when).getFullYear(),
    clientRating: null,
    deadlineDays: row.deadline_days || 5,
    meetingTimeNepal: row.meeting_pattern || 'To be agreed',
    needsOwnLaptop: !!row.needs_own_laptop,
    internetNeed: row.internet_need || 'Varies',
    caution: row.caution_note || (row.payment_verified ? null : 'Payment has not been verified. Do not send money to apply.'),
    deliverables: row.deliverables || [],
    clientProvides: row.client_provides || [],
  };
}
