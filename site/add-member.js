const formEl = document.getElementById('addMemberForm');
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
const dateOfBirthInput = document.getElementById('dateOfBirth');
const addressInput = document.getElementById('address');
const notesInput = document.getElementById('notes');
const submitBtn = document.getElementById('submitBtn');
const cancelBtn = document.getElementById('cancelBtn');
const alertEl = document.getElementById('alert');

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
    dateOfBirth: dateOfBirthInput.value || undefined,
    address: addressInput.value.trim() || undefined,
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

formEl.addEventListener('submit', handleSubmit);

// Load departments when page loads
document.addEventListener('DOMContentLoaded', loadDepartments);
