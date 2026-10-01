import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { PROGRAMS } from '../../constants';

const STEPS = ['Availability & Courses', 'Your Information', 'Education & Documents', 'Review & Submit'];
// Max courses an applicant may apply to at once — same limit regardless of
// full-time/part-time status (board correction, 2026-09-30). Kept in sync
// with the same constant in server/src/routes/applications.js.
const MAX_COURSES = 10;

export default function Apply() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [enrollmentType, setEnrollmentType] = useState('FULL_TIME');
  const [form, setForm] = useState({
    name: '', gNumber: '', phone: '', program: '',
    degree: '', expectedGraduation: '', gpa: '', priorExperience: '',
    recommenders: '',
    coursesRegisteredNextTerm: '', paidPositionLast2Years: null,
    onboardingPacketCompleted: null, i9FormCompleted: null,
    isFinalSemester: null, tuitionStatus: '',
  });
  // Hours worked outside GMU is asked once PER SEMESTER, not once-ever —
  // it lives on the Application row, so "already answered" is worked out
  // from past applications matching the term(s) being applied to (below).
  const [hoursWorkedOutsideGMU, setHoursWorkedOutsideGMU] = useState('');
  const [myApplications, setMyApplications] = useState([]);
  const [resumeFileName, setResumeFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // GPA / course registration / onboarding packet & I-9 are asked only once —
  // the first time an applicant ever starts an application. Once answered,
  // they're reused automatically and not asked again on future applications.
  const [askOnce, setAskOnce] = useState({});

  useEffect(() => {
    Promise.all([api.getCourses(), api.getProfile(), api.getMyApplications()]).then(([courseData, profData, appData]) => {
      setCourses(courseData.courses);
      setLoadingCourses(false);
      setMyApplications(appData.applications);
      const p = profData.profile;
      setResumeFileName(p.resumeFileName || '');
      setForm((f) => ({
        ...f,
        name: p.name || '',
        gNumber: p.gNumber || '',
        phone: p.phone || '',
        program: p.program || '',
        degree: p.degree || '',
        expectedGraduation: p.expectedGraduation || '',
        gpa: p.gpa || '',
        priorExperience: p.priorExperience || '',
        recommenders: p.recommenders || '',
        coursesRegisteredNextTerm: p.coursesRegisteredNextTerm ?? '',
        paidPositionLast2Years: p.paidPositionLast2Years ?? null,
        onboardingPacketCompleted: p.onboardingPacketCompleted ?? null,
        i9FormCompleted: p.i9FormCompleted ?? null,
        isFinalSemester: p.isFinalSemester ?? null,
        tuitionStatus: p.tuitionStatus || '',
      }));
      setAskOnce({
        gpa: !p.gpa,
        coursesRegisteredNextTerm: p.coursesRegisteredNextTerm == null,
        paidPositionLast2Years: p.paidPositionLast2Years == null,
        isFinalSemester: p.isFinalSemester == null,
        tuitionStatus: !p.tuitionStatus,
      });
    });
  }, []);

  const cap = MAX_COURSES;
  const toggleSection = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const capNote = () => {
    if (selected.size === 0) return { text: `Select at least one course (up to ${cap}).`, ok: false };
    if (selected.size > cap) return { text: `You've selected ${selected.size} courses — you may select up to ${cap}. Remove one to continue.`, ok: false };
    return { text: `${selected.size} of ${cap} courses selected.`, ok: true };
  };

  const canAdvanceStep0 = selected.size > 0 && selected.size <= cap;

  const goNext = async () => {
    setError('');
    if (step === 0 && !canAdvanceStep0) return;
    if (step < STEPS.length - 1) { setStep(step + 1); return; }

    setSubmitting(true);
    try {
      // resumeFileName is reused like recommenders/priorExperience/degree —
      // saved back to the profile so it's pre-filled on the next application.
      await api.updateProfile({ ...form, resumeFileName });
      await api.submitApplication({
        courseIds: Array.from(selected),
        enrollmentType,
        resumeFileName: resumeFileName || undefined,
        hoursWorkedOutsideGMU: hoursWorkedOutsideGMU || undefined,
      });
      navigate('/applications');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => { if (step > 0) setStep(step - 1); };

  const chosenCourses = courses.filter((c) => selected.has(c.id));
  const note = capNote();

  // Minimum courses registered for the upcoming semester (board feedback
  // item 3): full-time + final-semester only needs 1; everyone else needs 2.
  const minCoursesRegistered = (enrollmentType === 'FULL_TIME' && form.isFinalSemester === true) ? 1 : 2;

  // Hours worked outside GMU is asked once PER SEMESTER — only show it when
  // the applicant hasn't already answered it on a past application for one
  // of the term(s) they're applying to now.
  const chosenTerms = [...new Set(chosenCourses.map((c) => c.term))];
  const needsHoursWorkedOutsideGMU = chosenTerms.length > 0 && chosenTerms.some(
    (term) => !myApplications.some((a) => a.term === term && a.hoursWorkedOutsideGMU != null)
  );

  return (
    <>
      <div className="stepper">
        {STEPS.map((label, i) => (
          <div key={label} style={{ display: 'contents' }}>
            <div className={`step-item ${i < step ? 'done' : i === step ? 'current' : ''}`}>
              <div className="dot">{i < step ? '✓' : i + 1}</div>
              <div className="label">{label}</div>
            </div>
            {i < STEPS.length - 1 && <div className={`step-line ${i < step ? 'done' : ''}`} />}
          </div>
        ))}
      </div>

      <div className="wizard-card">
        {error && <div className="error-banner">{error}</div>}

        {step === 0 && (
          <>
            <h2>Availability &amp; Courses</h2>
            <div className="sub">Select the courses you're available to support this term. A faculty member will assign you to a specific section (and hours) if you're hired.</div>
            <div className="field full">
              <label>Enrollment status</label>
              <select value={enrollmentType} onChange={(e) => { setEnrollmentType(e.target.value); }}>
                <option value="FULL_TIME">Full-time student</option>
                <option value="PART_TIME">Part-time student</option>
              </select>
            </div>
            {loadingCourses ? (
              <div className="center-loading">Loading open courses…</div>
            ) : (
              <div className="section-list">
                {courses.map((c) => {
                  const isSelected = selected.has(c.id);
                  return (
                    <label key={c.id} className={`section-option ${isSelected ? 'selected' : ''}`}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSection(c.id)} />
                      <div className="meta">
                        <div className="course">{c.courseCode} — {c.courseTitle}</div>
                        <div className="details">{c.term} · {c.sectionCount} section{c.sectionCount === 1 ? '' : 's'} offered</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            <div className={`cap-note ${note.ok ? 'ok' : ''}`}>{note.text}</div>
          </>
        )}

        {step === 1 && (
          <>
            <h2>Your Information</h2>
            <div className="sub">This information will be saved to your profile for future applications.</div>
            <div className="form-grid">
              <div className="field"><label>Full legal name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="field"><label>GMU G-Number</label><input value={form.gNumber} onChange={(e) => setForm({ ...form, gNumber: e.target.value })} placeholder="G01234567" /></div>
              <div className="field"><label>Phone number</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(703) 555-0100" /></div>
              <div className="field full">
                <label>Department / Program</label>
                <select value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })}>
                  <option value="">Select a program</option>
                  {PROGRAMS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Education &amp; Documents</h2>
            <div className="sub">Tell us about your academic background and attach supporting documents.</div>
            <div className="form-grid">
              <div className="field"><label>Current degree program</label><input value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} placeholder="e.g. MS Computer Science" /></div>
              <div className="field"><label>Expected graduation term</label><input value={form.expectedGraduation} onChange={(e) => setForm({ ...form, expectedGraduation: e.target.value })} placeholder="e.g. Spring 2028" /></div>
              {askOnce.gpa && (
                <div className="field">
                  <label>Cumulative GPA <span style={{ color: 'crimson' }}>* (3.0 minimum to apply)</span></label>
                  <input value={form.gpa} onChange={(e) => setForm({ ...form, gpa: e.target.value })} placeholder="e.g. 3.7" />
                </div>
              )}
              <div className="field"><label>Prior TA / grading experience</label><input value={form.priorExperience} onChange={(e) => setForm({ ...form, priorExperience: e.target.value })} placeholder="e.g. None, or course names" /></div>
            </div>
            <div className="field full">
              <label>Resume / CV</label>
              <label className="upload-box">
                {resumeFileName ? 'Change file' : 'Click to choose a file (PDF, DOCX)'}
                <input type="file" style={{ display: 'none' }} onChange={(e) => setResumeFileName(e.target.files[0]?.name || '')} />
                {resumeFileName && <div className="file-chip">📎 {resumeFileName}</div>}
              </label>
            </div>
            <div className="field full">
              <label>Letter of Recommendation</label>
              <div className="sub" style={{ marginTop: -4, marginBottom: 8 }}>No need to upload a file — just give us the names of professors who highly rate/recommend you.</div>
              <textarea
                rows={2}
                value={form.recommenders}
                onChange={(e) => setForm({ ...form, recommenders: e.target.value })}
                placeholder="e.g. Dr. Jane Smith, Dr. John Lee"
              />
            </div>

            {(askOnce.coursesRegisteredNextTerm || askOnce.paidPositionLast2Years || askOnce.isFinalSemester || askOnce.tuitionStatus) && (
              <div className="profile-section-sub" style={{ marginTop: 20 }}>
                A few things we only ask once — reused automatically on future applications.
              </div>
            )}

            {askOnce.isFinalSemester && (
              <div className="onb-q">
                <div className="onb-label">Is this your final semester?</div>
                <div className="onb-toggle">
                  <button type="button" className={form.isFinalSemester === true ? 'on' : ''} onClick={() => setForm({ ...form, isFinalSemester: true })}>Yes</button>
                  <button type="button" className={form.isFinalSemester === false ? 'on' : ''} onClick={() => setForm({ ...form, isFinalSemester: false })}>No</button>
                </div>
              </div>
            )}

            {askOnce.coursesRegisteredNextTerm && (
              <div className="onb-q">
                <div className="onb-label">How many course(s) have you registered for the upcoming semester?</div>
                <input
                  type="number"
                  min="0"
                  className="onb-number"
                  value={form.coursesRegisteredNextTerm}
                  onChange={(e) => setForm({ ...form, coursesRegisteredNextTerm: e.target.value })}
                />
                <div className="hours-total-note" style={{ color: 'var(--muted, #666)' }}>
                  You need at least {minCoursesRegistered} course{minCoursesRegistered === 1 ? '' : 's'} registered to apply
                  {enrollmentType === 'FULL_TIME' && form.isFinalSemester === true ? ' (1 is enough since this is your final semester as a full-time student)' : ''}.
                </div>
              </div>
            )}

            {askOnce.tuitionStatus && (
              <div className="onb-q">
                <div className="onb-label">Tuition status</div>
                <div className="onb-toggle">
                  <button type="button" className={form.tuitionStatus === 'In-state' ? 'on' : ''} onClick={() => setForm({ ...form, tuitionStatus: 'In-state' })}>In-state</button>
                  <button type="button" className={form.tuitionStatus === 'Out-of-state' ? 'on' : ''} onClick={() => setForm({ ...form, tuitionStatus: 'Out-of-state' })}>Out-of-state</button>
                </div>
              </div>
            )}

            {needsHoursWorkedOutsideGMU && (
              <div className="onb-q">
                <div className="onb-label">Hours worked outside GMU per week (this semester)</div>
                <div className="sub" style={{ marginTop: -4, marginBottom: 8 }}>Asked once per semester — enter 0 if none.</div>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="onb-number"
                  value={hoursWorkedOutsideGMU}
                  onChange={(e) => setHoursWorkedOutsideGMU(e.target.value)}
                />
              </div>
            )}

            {askOnce.paidPositionLast2Years && (
              <>
                <div className="onb-q">
                  <div className="onb-label">Have you held a paid position in the last 2 years at George Mason University?</div>
                  <div className="onb-toggle">
                    <button type="button" className={form.paidPositionLast2Years === true ? 'on' : ''} onClick={() => setForm({ ...form, paidPositionLast2Years: true })}>Yes</button>
                    <button type="button" className={form.paidPositionLast2Years === false ? 'on' : ''} onClick={() => setForm({ ...form, paidPositionLast2Years: false })}>No</button>
                  </div>
                </div>
                {form.paidPositionLast2Years === false && (
                  <div className="onb-nested">
                    <div className="onb-because">Because of the answer above</div>
                    <div className="onb-q">
                      <div className="onb-label">Have you completed the Employee Onboarding Packet?</div>
                      <div className="onb-toggle">
                        <button type="button" className={form.onboardingPacketCompleted === true ? 'on' : ''} onClick={() => setForm({ ...form, onboardingPacketCompleted: true })}>Yes</button>
                        <button type="button" className={form.onboardingPacketCompleted === false ? 'on' : ''} onClick={() => setForm({ ...form, onboardingPacketCompleted: false })}>No</button>
                      </div>
                    </div>
                    <div className="onb-q">
                      <div className="onb-label">Have you completed the I-9 Form?</div>
                      <div className="onb-toggle">
                        <button type="button" className={form.i9FormCompleted === true ? 'on' : ''} onClick={() => setForm({ ...form, i9FormCompleted: true })}>Yes</button>
                        <button type="button" className={form.i9FormCompleted === false ? 'on' : ''} onClick={() => setForm({ ...form, i9FormCompleted: false })}>No</button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <h2>Review &amp; Submit</h2>
            <div className="sub">Confirm your details before submitting your application.</div>
            <div className="review-block">
              <div className="rb-head"><h4>Availability &amp; Courses</h4><button onClick={() => setStep(0)}>Edit</button></div>
              <dl>
                <dt>Enrollment</dt><dd>{enrollmentType === 'FULL_TIME' ? 'Full-time' : 'Part-time'}</dd>
                <dt>Courses</dt><dd>{chosenCourses.length ? chosenCourses.map((c) => `${c.courseCode} (${c.term})`).join(', ') : <em>None selected</em>}</dd>
              </dl>
            </div>
            <div className="review-block">
              <div className="rb-head"><h4>Your Information</h4><button onClick={() => setStep(1)}>Edit</button></div>
              <dl>
                <dt>Name</dt><dd>{form.name || <em>Not provided</em>}</dd>
                <dt>G-Number</dt><dd>{form.gNumber || <em>Not provided</em>}</dd>
                <dt>Phone</dt><dd>{form.phone || <em>Not provided</em>}</dd>
                <dt>Program</dt><dd>{form.program || <em>Not provided</em>}</dd>
              </dl>
            </div>
            <div className="review-block">
              <div className="rb-head"><h4>Education &amp; Documents</h4><button onClick={() => setStep(2)}>Edit</button></div>
              <dl>
                <dt>Degree</dt><dd>{form.degree || <em>Not provided</em>}</dd>
                <dt>Expected grad.</dt><dd>{form.expectedGraduation || <em>Not provided</em>}</dd>
                <dt>GPA</dt><dd>{form.gpa || <em>Not provided</em>}</dd>
                <dt>Resume</dt><dd>{resumeFileName || <em>No file attached</em>}</dd>
                <dt>Recommenders</dt><dd>{form.recommenders || <em>Not provided</em>}</dd>
                {form.coursesRegisteredNextTerm !== '' && (
                  <>
                    <dt>Courses registered (upcoming term)</dt><dd>{form.coursesRegisteredNextTerm}</dd>
                  </>
                )}
                {form.paidPositionLast2Years !== null && (
                  <>
                    <dt>Paid position at GMU (last 2 yrs)</dt><dd>{form.paidPositionLast2Years ? 'Yes' : 'No'}</dd>
                  </>
                )}
                {form.isFinalSemester !== null && (
                  <>
                    <dt>Final semester</dt><dd>{form.isFinalSemester ? 'Yes' : 'No'}</dd>
                  </>
                )}
                {form.tuitionStatus !== '' && (
                  <>
                    <dt>Tuition status</dt><dd>{form.tuitionStatus}</dd>
                  </>
                )}
                {hoursWorkedOutsideGMU !== '' && (
                  <>
                    <dt>Hours worked outside GMU</dt><dd>{hoursWorkedOutsideGMU} hrs/week</dd>
                  </>
                )}
              </dl>
            </div>
          </>
        )}

        <div className="wizard-footer">
          <button className="btn-secondary" onClick={goBack} style={{ visibility: step === 0 ? 'hidden' : 'visible' }}>Back</button>
          <button className="btn-primary" onClick={goNext} disabled={submitting || (step === 0 && !canAdvanceStep0)}>
            {submitting ? 'Submitting…' : step === STEPS.length - 1 ? 'Submit Application' : 'Continue'}
          </button>
        </div>
      </div>
    </>
  );
}
