// Guided posting templates: one per category. Choosing one pre-fills the
// skills, the deliverable specs and a fair budget range (shown as a hint;
// the client still types the final number). Everything stays editable.
// Specs here must pass validateSpec in utils/deliverables.js.
export const JOB_TEMPLATES = [
  {
    category: 'Design',
    skills: ['Logo Design', 'Canva', 'Photoshop'],
    budgetLow: 40, budgetHigh: 100,
    specs: [
      { name: 'Logo files', description: 'Final logo in PNG and SVG, transparent background, at least 2000px wide, print-ready.', quantity: 1, formats: ['png', 'svg'], max_mb: 10, link_allowed: false, milestone: null },
    ],
  },
  {
    category: 'Writing',
    skills: ['English Writing'],
    budgetLow: 30, budgetHigh: 80,
    specs: [
      { name: 'Article document', description: 'One article as a DOCX file, about 800 words, with a title and subheadings, in simple English.', quantity: 1, formats: ['docx', 'pdf'], max_mb: 10, link_allowed: false, milestone: null },
    ],
  },
  {
    category: 'Data Entry',
    skills: ['Typing / Data Entry', 'Excel / Spreadsheets'],
    budgetLow: 30, budgetHigh: 70,
    specs: [
      { name: 'Spreadsheet', description: 'Completed spreadsheet in XLSX with every row filled and checked once for mistakes or duplicates.', quantity: 1, formats: ['xlsx', 'csv'], max_mb: 10, link_allowed: false, milestone: null },
    ],
  },
  {
    category: 'Social Media',
    skills: ['Canva', 'Social Media Posts'],
    budgetLow: 40, budgetHigh: 90,
    specs: [
      { name: 'Post designs', description: 'Finished social media posts as PNG files, sized for the platform, with text, prices and logo added.', quantity: 12, formats: ['png', 'jpg'], max_mb: 10, link_allowed: false, milestone: null },
    ],
  },
  {
    category: 'Translation',
    skills: ['Translation', 'Nepali Writing', 'English Writing'],
    budgetLow: 20, budgetHigh: 50,
    specs: [
      { name: 'Translated document', description: 'Full translation as a DOCX file, with names, dates and numbers checked exactly against the original.', quantity: 1, formats: ['docx', 'pdf'], max_mb: 10, link_allowed: false, milestone: null },
    ],
  },
  {
    category: 'Virtual Assistant',
    skills: ['English Writing', 'Customer Chat Support'],
    budgetLow: 25, budgetHigh: 60,
    specs: [
      { name: 'Daily summary', description: 'A short daily summary in DOCX listing the replies sent and the questions passed to the owner.', quantity: 1, formats: ['docx', 'txt'], max_mb: 10, link_allowed: true, milestone: null },
    ],
  },
  {
    category: 'Video',
    skills: ['Video Editing'],
    budgetLow: 50, budgetHigh: 120,
    specs: [
      { name: 'Edited video', description: 'Final edited video in MP4 at 1080p, with subtitles burned in and a separate subtitle file if asked.', quantity: 1, formats: ['mp4', 'mov'], max_mb: 100, link_allowed: true, milestone: null },
    ],
  },
];
