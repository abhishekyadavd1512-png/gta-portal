import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { PROGRAMS, DEGREE_LEVELS, buildUpcomingTermOptions, buildUpcomingYearOptions } from '../../constants';

// Full applicant profile, matching every field on the original PowerApps
// "Profile" Dataverse table (see the project's profiles-table-recreation-plan
// doc for the authoritative column list). Organized into the same groupings
// as the old app's screens: Personal Information, Eligibility & Work
// Authorization, Education, Experience, and Documents (which includes the
// unofficial transcript upload that was flagged as missing in review).
//
// Per review feedback, the "Are you a U.S. citizen or permanent resident?"
// branch (SSN / new-GTA status / CELTD) lives here at profile creation time,
// not gated behind a post-hire questionnaire. GPA, course registration, and
// the Onboarding Packet / I-9 questions were moved out of here entirely —
// they're asked once, the first time an applicant starts an application (see
// client/src/pages/applicant/Apply.jsx), then reused automatically after that.
//
// Dropdown option lists below (STATES/COLLEGES/etc.) are reasonable defaults,
// not pulled from the live Dataverse Choice columns — edit them to match the
// exact option sets from the original app whenever that list is available.

const STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois',
  'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts',
  'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota',
  'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming', 'Other / Outside the U.S.',
];

const COLLEGES = [
  'College of Engineering and Computing',
  'College of Science',
  'Costello College of Business',
  'College of Education and Human Development',
  'College of Humanities and Social Sciences',
  'College of Public Health',
  'Schar School of Policy and Government',
  'Antonin Scalia Law School',
  'Other',
];

const SEMESTERS = ['Fall', 'Spring', 'Summer'];
const PHD_CONCENTRATIONS = [
  'Information Security', 'Data Analytics Engineering', 'Software Engineering',
  'Network Engineering', 'Other',
];

const PERSONAL_FIELDS = [
  { key: 'name', label: 'Full legal name' },
  { key: 'preferredName', label: 'Preferred name' },
  { key: 'gNumber', label: 'GMU G-Number' },
  { key: 'phone', label: 'Phone number' },
  { key: 'addressLine1', label: 'Address line 1' },
  { key: 'addressLine2', label: 'Address line 2' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State', type: 'select', options: STATES },
  { key: 'zip', label: 'ZIP code' },
  { key: 'linkedIn', label: 'LinkedIn profile URL' },
];

function getEducationFields(form) {
  const fields = [
    { key: 'program', label: 'Department / Program', type: 'select', options: PROGRAMS },
    { key: 'college', label: 'College', type: 'select', options: COLLEGES },
    { key: 'major', label: 'Major' },
    { key: 'degree', label: 'Degree level (e.g. MS, PhD)', type: 'select', options: DEGREE_LEVELS },
    { key: 'expectedGraduation', label: 'Expected graduation term', type: 'select', options: buildUpcomingTermOptions() },
    { key: 'anticipatedGraduationSemester', label: 'Anticipated graduation semester', type: 'select', options: SEMESTERS },
    { key: 'anticipatedGraduationYear', label: 'Anticipated graduation year', type: 'select', options: buildUpcomingYearOptions() },
    { key: 'earnedDegreePreviously', label: 'Have you earned a degree previously?', type: 'yesno' },
  ];
  if (form.earnedDegreePreviously === true) {
    fields.push(
      { key: 'highestDegreeDegree', label: 'Highest degree earned', type: 'select', options: DEGREE_LEVELS },
      { key: 'highestDegreeMajor', label: 'Highest degree major' },
      { key: 'highestDegreeUniversity', label: 'University' },
      { key: 'highestDegreeYear', label: 'Year completed', type: 'number' },
    );
  }
  return fields;
}

function getExperienceFields(form) {
  const fields = [
    { key: 'priorExperience', label: 'Prior TA / grading experience', type: 'textarea', full: true },
    { key: 'recommenders', label: 'Letter of Recommendation — names of professors who highly rate/recommend you', type: 'textarea', full: true },
    { key: 'gtaExperience', label: 'Do you have prior GTA experience?', type: 'yesno' },
  ];
  if (form.gtaExperience === true) {
    fields.push(
      { key: 'gtaSemesters', label: 'How many semesters?', type: 'number' },
      { key: 'priorGTAExperienceInfo', label: 'Tell us about your prior GTA experience', type: 'textarea', full: true },
    );
  }
  fields.push({ key: 'priorITExperience', label: 'Do you have prior IT industry experience?', type: 'yesno' });
  if (form.priorITExperience === true) {
    fields.push(
      { key: 'itIndustryYoe', label: 'Years of IT industry experience', type: 'number' },
      { key: 'technology', label: "Technologies / tools you've worked with", type: 'text', full: true },
    );
  }
  fields.push({ key: 'workedForGMUBefore', label: 'Have you worked for GMU before?', type: 'yesno' });
  if (form.workedForGMUBefore === true) {
    fields.push({ key: 'whereAtGMU', label: 'Where at GMU?' });
  }
  fields.push(
    { key: 'phdDissertationAdvisor', label: 'PhD dissertation advisor (if applicable)' },
    { key: 'phdITConcentration', label: 'PhD IT concentration (if applicable)', type: 'select', options: PHD_CONCENTRATIONS },
  );
  return fields;
}

// For the read-only view of the Eligibility section — mirrors the branching
// in <EligibilityEdit> below so only relevant answers are shown.
function getEligibilityDisplayFields(profile) {
  const fields = [
    { key: 'usCitizenOrPermRes', label: 'U.S. citizen or permanent resident?', type: 'yesno' },
  ];
  if (profile.usCitizenOrPermRes === false) {
    fields.push(
      { key: 'hasSSN', label: 'Has a Social Security Number?', type: 'yesno' },
      { key: 'isNewGTA', label: 'New Graduate Teaching Assistant?', type: 'yesno' },
    );
    if (profile.isNewGTA === true) {
      fields.push(
        { key: 'celtdCompleted', label: 'Completed CELTD?', type: 'yesno' },
        { key: 'celtdEvidenceFileName', label: 'CELTD evidence of completion', type: 'file' },
      );
    } else if (profile.isNewGTA === false) {
      fields.push({ key: 'celtdCertificateFileName', label: 'CELTD certificate', type: 'file' });
    }
  }
  return fields;
}

const DOCUMENT_FIELDS = [
  { key: 'resumeFileName', label: 'Resume' },
  { key: 'unofficialTranscriptFileName', label: 'Unofficial transcript' },
];

function FieldInput({ f, value, onChange }) {
  const cls = `field${f.full ? ' full' : ''}`;
  if (f.type === 'yesno') {
    return (
      <div className={cls}>
        <label>{f.label}</label>
        <div className="onb-toggle" style={{ alignSelf: 'flex-start' }}>
          <button type="button" className={value === true ? 'on' : ''} onClick={() => onChange(true)}>Yes</button>
          <button type="button" className={value === false ? 'on' : ''} onClick={() => onChange(false)}>No</button>
        </div>
      </div>
    );
  }
  if (f.type === 'select') {
    return (
      <div className={cls}>
        <label>{f.label}</label>
        <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Select —</option>
          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  if (f.type === 'textarea') {
    return (
      <div className={cls}>
        <label>{f.label}</label>
        <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  return (
    <div className={cls}>
      <label>{f.label}</label>
      <input type={f.type === 'number' ? 'number' : 'text'} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function FieldDisplay({ f, value }) {
  let display;
  if (f.type === 'yesno') display = value === true ? 'Yes' : value === false ? 'No' : null;
  else if (f.type === 'file') display = value ? `📎 ${value}` : null;
  else display = (value === null || value === undefined || value === '') ? null : value;
  return (
    <Fragment>
      <dt>{f.label}</dt>
      <dd>{display !== null && display !== undefined ? String(display) : <em>Not provided</em>}</dd>
    </Fragment>
  );
}

function UploadField({ label, fileName, onChange }) {
  return (
    <div className="onb-q" style={{ marginBottom: 0 }}>
      <div className="onb-label">{label}</div>
      <label className="upload-box" style={{ display: 'inline-block', maxWidth: 320 }}>
        {fileName ? 'Change file' : 'Click to choose a file'}
        <input type="file" style={{ display: 'none' }} onChange={(e) => onChange(e.target.files[0]?.name || '')} />
        {fileName && <div className="file-chip">📎 {fileName}</div>}
      </label>
    </div>
  );
}

// Interactive branching version of the Eligibility & Work Authorization
// questions, shown while editing the profile. Moved here from the old
// post-hire "Accepted the offer" questionnaire per review feedback — these
// are now asked as part of creating/editing your profile, not gated behind
// being hired.
function EligibilityEdit({ form, set }) {
  return (
    <>
      <div className="onb-q">
        <div className="onb-label">Are you a U.S. citizen or a permanent resident?</div>
        <div className="onb-toggle">
          <button type="button" className={form.usCitizenOrPermRes === true ? 'on' : ''} onClick={() => set('usCitizenOrPermRes')(true)}>Yes</button>
          <button type="button" className={form.usCitizenOrPermRes === false ? 'on' : ''} onClick={() => set('usCitizenOrPermRes')(false)}>No</button>
        </div>
      </div>
      {form.usCitizenOrPermRes === false && (
        <div className="onb-nested">
          <div className="onb-because">Because of the answer above</div>
          <div className="onb-q">
            <div className="onb-label">Do you have a Social Security Number?</div>
            <div className="onb-toggle">
              <button type="button" className={form.hasSSN === true ? 'on' : ''} onClick={() => set('hasSSN')(true)}>Yes</button>
              <button type="button" className={form.hasSSN === false ? 'on' : ''} onClick={() => set('hasSSN')(false)}>No</button>
            </div>
          </div>
          <div className="onb-q">
            <div className="onb-label">Are you a new Graduate Teaching Assistant?</div>
            <div className="onb-toggle">
              <button type="button" className={form.isNewGTA === true ? 'on' : ''} onClick={() => set('isNewGTA')(true)}>Yes</button>
              <button type="button" className={form.isNewGTA === false ? 'on' : ''} onClick={() => set('isNewGTA')(false)}>No</button>
            </div>
          </div>

          {form.isNewGTA === true && (
            <div className="onb-nested">
              <div className="onb-because">Because you're a new GTA</div>
              <div className="onb-q">
                <div className="onb-label">Have you completed CELTD?</div>
                <div className="onb-toggle">
                  <button type="button" className={form.celtdCompleted === true ? 'on' : ''} onClick={() => set('celtdCompleted')(true)}>Yes</button>
                  <button type="button" className={form.celtdCompleted === false ? 'on' : ''} onClick={() => set('celtdCompleted')(false)}>No</button>
                </div>
              </div>
              {form.celtdCompleted === true && (
                <UploadField label="Upload evidence of completion" fileName={form.celtdEvidenceFileName} onChange={set('celtdEvidenceFileName')} />
              )}
              {form.celtdCompleted === false && (
                <div className="onb-note">You'll need to complete CELTD — we'll follow up with next steps separately.</div>
              )}
            </div>
          )}

          {form.isNewGTA === false && (
            <div className="onb-nested">
              <div className="onb-because">Because you're a returning GTA</div>
              <UploadField label="Upload your CELTD certificate" fileName={form.celtdCertificateFileName} onChange={set('celtdCertificateFileName')} />
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getProfile().then((data) => { setProfile(data.profile); setForm(data.profile); });
  }, []);

  if (!profile) return <div className="center-loading">Loading your profile…</div>;

  const isEmpty = !profile.program && !profile.degree && !profile.gNumber;
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  if (isEmpty && !editing) {
    return (
      <div className="empty-state">
        <div className="icon">👤</div>
        <h3>No profile on file yet</h3>
        <p>Your profile hasn't been created. Add your program, department, and contact information — it will be reused automatically on every GTA application you submit.</p>
        <button className="btn-primary" onClick={() => setEditing(true)}>Create your profile</button>
      </div>
    );
  }

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateProfile(form);
      setProfile(updated.profile);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    const educationFields = getEducationFields(form);
    const experienceFields = getExperienceFields(form);
    return (
      <div className="wizard-card">
        <h2>{isEmpty ? 'Create your profile' : 'Edit your profile'}</h2>
        <div className="sub">This information will be reused on future GTA applications.</div>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSave}>
          <div className="profile-section-title">Personal Information</div>
          <div className="form-grid">
            {PERSONAL_FIELDS.map((f) => (
              <FieldInput key={f.key} f={f} value={form[f.key]} onChange={set(f.key)} />
            ))}
          </div>

          <div className="profile-section-title">Eligibility &amp; Work Authorization</div>
          <EligibilityEdit form={form} set={set} />

          <div className="profile-section-title">Education</div>
          <div className="form-grid">
            {educationFields.map((f) => (
              <FieldInput key={f.key} f={f} value={form[f.key]} onChange={set(f.key)} />
            ))}
          </div>

          <div className="profile-section-title">Experience</div>
          <div className="form-grid">
            {experienceFields.map((f) => (
              <FieldInput key={f.key} f={f} value={form[f.key]} onChange={set(f.key)} />
            ))}
          </div>

          <div className="profile-section-title">Documents</div>
          <div className="profile-section-sub">Uploads are stored by file name for this prototype — attaching the real file content is a later step.</div>
          <div className="profile-upload-row">
            {DOCUMENT_FIELDS.map((f) => (
              <UploadField key={f.key} label={f.label} fileName={form[f.key]} onChange={set(f.key)} />
            ))}
          </div>

          <div className="wizard-footer" style={{ marginTop: 28 }}>
            <button type="button" className="btn-secondary" onClick={() => { setForm(profile); setEditing(false); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
          </div>
        </form>
      </div>
    );
  }

  const educationFields = getEducationFields(profile);
  const experienceFields = getExperienceFields(profile);
  const eligibilityFields = getEligibilityDisplayFields(profile);

  return (
    <div className="wizard-card">
      <h2>My Profile</h2>
      <div className="sub">{profile.email}</div>

      <div className="profile-section-title">Personal Information</div>
      <div className="review-block">
        <dl>
          {PERSONAL_FIELDS.map((f) => <FieldDisplay key={f.key} f={f} value={profile[f.key]} />)}
        </dl>
      </div>

      <div className="profile-section-title">Eligibility &amp; Work Authorization</div>
      <div className="review-block">
        <dl>
          {eligibilityFields.map((f) => <FieldDisplay key={f.key} f={f} value={profile[f.key]} />)}
        </dl>
      </div>

      <div className="profile-section-title">Education</div>
      <div className="review-block">
        <dl>
          {educationFields.map((f) => <FieldDisplay key={f.key} f={f} value={profile[f.key]} />)}
        </dl>
      </div>

      <div className="profile-section-title">Experience</div>
      <div className="review-block">
        <dl>
          {experienceFields.map((f) => <FieldDisplay key={f.key} f={f} value={profile[f.key]} />)}
        </dl>
      </div>

      <div className="profile-section-title">Documents</div>
      <div className="review-block">
        <dl>
          {DOCUMENT_FIELDS.map((f) => <FieldDisplay key={f.key} f={f} value={profile[f.key]} />)}
        </dl>
      </div>

      <div className="wizard-footer">
        <Link to="/applications"><button className="btn-secondary">View my applications</button></Link>
        <button className="btn-primary" onClick={() => setEditing(true)}>Edit profile</button>
      </div>
    </div>
  );
}
