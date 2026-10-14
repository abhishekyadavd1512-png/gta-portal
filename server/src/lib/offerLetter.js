// Shared "Offer Letter Ready" eligibility logic — used by both the Faculty
// Dashboard (routes/faculty.js) and the Admin "Export Offer Ready" / "Trigger
// Offer Letter Flow" actions (routes/admin.js), so there is exactly one
// definition of what "ready" means.
//
// Board feedback item 4 ("Offer Letter — SharePoint", 2026-09-30): the app
// does not maintain a standing integration with SharePoint, and it never
// sends anything on its own — every hand-off here still starts with a human
// clicking a button. Two hand-off paths exist as of 2026-10-09:
//   1. CSV export ("Export Offer Ready" on the Admin dashboard) — always
//      available, no network call, for manual injection into SharePoint.
//   2. An optional Power Automate hand-off ("Trigger Offer Letter Flow" on
//      the Admin dashboard, see routes/admin.js) — POSTs the same data to a
//      Power Automate HTTP-trigger webhook, but ONLY when an admin clicks
//      the button AND someone with Microsoft 365/Power Platform access has
//      separately built, published, and configured that flow's URL via
//      POWER_AUTOMATE_OFFER_LETTER_WEBHOOK_URL. Until that env var is set,
//      the trigger endpoint refuses to do anything. What the Flow itself
//      does with the data (generate the letter, save it to SharePoint,
//      notify the student) is entirely outside this app's knowledge or
//      control — this app's job ends at handing the data off.

// Minimum GPA to apply (board feedback item 3, "Offer Letter") — kept in
// sync with the same constant in applications.js. Re-checked here (not just
// at application time) because profile fields can change after submission.
export const MIN_GPA = 3.0;

// Computes a read-only "Offer Letter Ready" flag so whoever runs the export
// (or clicks the Power Automate trigger) knows, at a glance, which fully-
// assigned (HIRED + section + hours set) GTAs also satisfy every one of the
// board's "Offer Letter" eligibility rules: GPA floor, minimum courses
// registered, Tuition status answered, and Hours worked outside GMU
// answered for the term. Returns both the boolean and the specific list of
// what's missing, so faculty/admin can see why someone isn't ready yet
// instead of just a plain yes/no.
export function computeOfferLetterStatus(a) {
  if (a.status !== 'HIRED' || a.assignedSectionId == null || a.hours == null) {
    return { offerLetterReady: false, offerLetterMissing: ['Not fully assigned to a section yet'] };
  }
  const missing = [];
  const gpaNum = Number(a.gpa);
  if (!a.gpa || Number.isNaN(gpaNum) || gpaNum < MIN_GPA) missing.push(`GPA below ${MIN_GPA.toFixed(1)}`);
  const minCourses = (a.enrollmentType === 'FULL_TIME' && a.isFinalSemester === true) ? 1 : 2;
  const registeredNum = Number(a.coursesRegisteredNextTerm);
  if (a.coursesRegisteredNextTerm == null || Number.isNaN(registeredNum) || registeredNum < minCourses) missing.push('Courses registered below minimum');
  if (!a.tuitionStatus) missing.push('Tuition status not answered');
  if (a.hoursWorkedOutsideGMU == null) missing.push('Hours worked outside GMU not answered');
  return { offerLetterReady: missing.length === 0, offerLetterMissing: missing };
}
