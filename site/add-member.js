const utrLookupInput = document.getElementById('utrLookupInput');
const utrLookupBtn = document.getElementById('utrLookupBtn');
const utrResultEl = document.getElementById('utrResult');

async function lookupUtr() {
  const query = utrLookupInput.value.trim();
  if (!query) return;

  utrLookupBtn.disabled = true;
  utrLookupBtn.textContent = 'Searching…';
  utrResultEl.hidden = true;

  try {
    const res = await fetch('../api/participants');
    const data = await res.json();
    const participants = data.data || [];

    const match = participants.find((p) => {
      const utrid = String(p.utrid || p.utrId || p.studentId || p.participantId || '').trim().toLowerCase();
      return utrid === query.toLowerCase();
    });

    if (match) {
      const events = Array.isArray(match.events)
        ? match.events.map((e) => e.eventName || e.name || e).filter(Boolean).join(', ')
        : (match.events || '—');

      utrResultEl.className = 'utrResult utrResult--found';
      utrResultEl.innerHTML = `
        <strong>Participant found</strong>
        <table>
          <tr><td>Name</td><td>${escapeHtml(match.studentName || `${match.firstName || ''} ${match.lastName || ''}`.trim() || '—')}</td></tr>
          <tr><td>Email</td><td>${escapeHtml(match.email || '—')}</td></tr>
          <tr><td>Phone</td><td>${escapeHtml(match.phone || '—')}</td></tr>
          <tr><td>College</td><td>${escapeHtml(match.college || '—')}</td></tr>
          <tr><td>Events</td><td>${escapeHtml(events || '—')}</td></tr>
          <tr><td>Payment</td><td>${escapeHtml(match.paymentStatus || '—')}</td></tr>
          <tr><td>Amount Paid</td><td>${match.amountPaid != null ? '₹' + match.amountPaid : '—'}</td></tr>
        </table>`;
    } else {
      utrResultEl.className = 'utrResult utrResult--notfound';
      utrResultEl.innerHTML = `No participant found with UTR ID <strong>${escapeHtml(query)}</strong>.`;
    }

    utrResultEl.hidden = false;
  } catch (err) {
    utrResultEl.className = 'utrResult utrResult--notfound';
    utrResultEl.textContent = `Lookup failed: ${err.message}`;
    utrResultEl.hidden = false;
  } finally {
    utrLookupBtn.disabled = false;
    utrLookupBtn.textContent = 'Look Up';
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

utrLookupBtn.addEventListener('click', lookupUtr);
utrLookupInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); lookupUtr(); } });

const formEl = document.getElementById('addMemberForm');
const downloadBtn = document.getElementById('downloadBtn');
const firstNameInput = document.getElementById('firstName');
const lastNameInput = document.getElementById('lastName');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const utridInput = document.getElementById('utrid');
const rollNumberInput = document.getElementById('rollNumber');
const collegeInput = document.getElementById('college');
const semesterInput = document.getElementById('semester');
const departmentSelect = document.getElementById('department');
const eventsInput = document.getElementById('events');
const paymentStatusSelect = document.getElementById('paymentStatus');
const amountPaidInput = document.getElementById('amountPaid');
const genderSelect = document.getElementById('gender');
const notesInput = document.getElementById('notes');
const submitBtn = document.getElementById('submitBtn');
const cancelBtn = document.getElementById('cancelBtn');
const alertEl = document.getElementById('alert');

// CSV Download functionality
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function downloadStudentsCSV() {
  downloadBtn.disabled = true;
  downloadBtn.textContent = '⏳ Loading...';

  try {
    const res = await fetch('../api/participants');
    const data = await res.json();
    let participants = data.data || [];

    if (participants.length === 0) {
      showAlert('No participants to download', 'error');
      downloadBtn.disabled = false;
      downloadBtn.textContent = '📥 Download CSV';
      return;
    }

    // Sort participants by ID (numerically)
    participants.sort((a, b) => {
      const idA = parseInt(a.participantId || a.id, 10) || 0;
      const idB = parseInt(b.participantId || b.id, 10) || 0;
      return idA - idB;
    });

    // Define CSV headers - based on actual API structure
    const headers = [
      'Participant ID',
      'Student Name',
      'Email',
      'Phone',
      'College',
      'Events',
      'Payment Status',
      'Amount Paid',
      'Registration Date'
    ];

    // Build CSV rows - map actual API fields
    const rows = participants.map((p) => {
      // Extract event names from nested events array
      const events = Array.isArray(p.events) 
        ? p.events.map(e => e.eventName || e.name || '').filter(Boolean).join('; ')
        : '';
      
      return [
        escapeCSV(p.participantId || p.id),
        escapeCSV(p.studentName || `${p.firstName || ''} ${p.lastName || ''}`.trim()),
        escapeCSV(p.email),
        escapeCSV(p.phone),
        escapeCSV(p.college),
        escapeCSV(events),
        escapeCSV(p.paymentStatus),
        escapeCSV(p.amountPaid),
        escapeCSV(p.registeredAt || p.registrationDate)
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map((row) => row.join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `participants_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showAlert(`Successfully downloaded ${participants.length} participants!`, 'success');
  } catch (err) {
    console.error('Error downloading CSV:', err);
    showAlert(`Error: ${err.message}`, 'error');
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.textContent = '📥 Download CSV';
  }
}

// Load departments on page load
async function loadDepartments() {
  try {
    const res = await fetch('../api/departments');
    const data = await res.json();
    const departments = data.data || [];

    // Clear existing options (except first placeholder)
    while (departmentSelect.options.length > 1) {
      departmentSelect.remove(1);
    }

    // Add department options
    departments.forEach((dept) => {
      const option = document.createElement('option');
      option.value = dept.key;
      option.textContent = `${dept.name} (${dept.key})`;
      departmentSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Failed to load departments:', err);
    showAlert('Failed to load departments', 'error');
  }
}

function showAlert(message, type = 'success') {
  alertEl.textContent = message;
  alertEl.className = `alert alert${type.charAt(0).toUpperCase() + type.slice(1)}`;
  alertEl.style.display = 'block';
  setTimeout(() => {
    alertEl.style.display = 'none';
  }, 5000);
}

async function handleSubmit(e) {
  e.preventDefault();

  // Basic validation
  if (!firstNameInput.value.trim() || !lastNameInput.value.trim()) {
    showAlert('First and last names are required', 'error');
    return;
  }

  if (!emailInput.value.trim()) {
    showAlert('Email is required', 'error');
    return;
  }

  if (!phoneInput.value.trim()) {
    showAlert('Phone number is required', 'error');
    return;
  }

  if (!utridInput.value.trim()) {
    showAlert('UTRID / Student ID is required', 'error');
    return;
  }

  if (!collegeInput.value.trim()) {
    showAlert('College name is required', 'error');
    return;
  }

  if (!departmentSelect.value) {
    showAlert('Please select a department', 'error');
    return;
  }

  if (!eventsInput.value.trim()) {
    showAlert('Please enter at least one event', 'error');
    return;
  }

  if (!paymentStatusSelect.value) {
    showAlert('Please select a payment status', 'error');
    return;
  }

  // Prepare events array - handle both comma-separated and newline-separated
  const eventsArray = eventsInput.value
    .split(/[,\n]/)
    .map((e) => e.trim())
    .filter(Boolean);

  if (eventsArray.length === 0) {
    showAlert('Please enter at least one event', 'error');
    return;
  }

  // Prepare payload
  const newMember = {
    firstName: firstNameInput.value.trim(),
    lastName: lastNameInput.value.trim(),
    email: emailInput.value.trim(),
    phone: phoneInput.value.trim(),
    utrid: utridInput.value.trim(),
    rollNumber: rollNumberInput.value.trim() || undefined,
    college: collegeInput.value.trim(),
    semester: semesterInput.value ? Number(semesterInput.value) : undefined,
    department: departmentSelect.value,
    events: eventsArray,
    paymentStatus: paymentStatusSelect.value,
    amountPaid: amountPaidInput.value ? Number(amountPaidInput.value) : 0,
    gender: genderSelect.value || undefined,
    notes: notesInput.value.trim() || undefined,
    registrationDate: new Date().toISOString(),
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Adding...';

  try {
    const res = await fetch('../api/members/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newMember),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error || 'Failed to add member');
    }

    showAlert('Member added successfully!', 'success');
    formEl.reset();

    // Redirect after 2 seconds
    setTimeout(() => {
      window.location.href = './admin.html';
    }, 2000);
  } catch (err) {
    console.error('Error adding member:', err);
    showAlert(`Error: ${err.message}`, 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Add Member';
  }
}

cancelBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
    window.location.href = './admin.html';
  }
});

downloadBtn.addEventListener('click', downloadStudentsCSV);
formEl.addEventListener('submit', handleSubmit);

// Load departments when page loads
document.addEventListener('DOMContentLoaded', loadDepartments);
