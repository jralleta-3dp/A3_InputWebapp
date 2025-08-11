// Google Sheet ID
const SPREADSHEET_ID = '1efR88nP511yGEPgjsR9KcT0nE2TQImzuxyYYZ6uUKGo'; 
const SHEET2_ID = 'Sheet2';
let imageCount = 1;

// Google Identity Services
let tokenClient;
const CLIENT_ID = '263288053429-39j61v5mij7mhrtqg9peqov1i33nedc6.apps.googleusercontent.com';

// Initialize page on load
window.onload = function() {
  localStorage.removeItem('accessToken');
  window.accessToken = null;
  initTokenClient();
  
  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    setTimeout(() => {
      initTokenClient();
      if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        alert("Google Sign-In failed to load. Please refresh the page.");
      }
    }, 1000);
  }
};

function initTokenClient() {
  if (typeof google !== 'undefined' && google.accounts) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      callback: (tokenResponse) => {
        if (tokenResponse.access_token) {
          window.accessToken = tokenResponse.access_token;
          localStorage.setItem('accessToken', tokenResponse.access_token);
          console.log("Successfully signed in with Google");
          initializePage();
        } else {
          alert("Google sign-in failed. Please try again.");
          window.location.href = 'index.html';
        }
      }
    });
  }
}

function initializePage() {
  updateFooterImageCount();
  setupBackNextButtons();
  setupWriteHandlers();
  fetchAndPrefillRow(imageCount - 1);
}

// Safe API call wrapper
function safeApiCall(apiFunction) {
  if (!window.accessToken) {
    return new Promise((resolve, reject) => {
      if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } else {
        alert("Sign-in required. Please refresh the page.");
        reject("No access token");
      }
    });
  }
  return apiFunction().catch(err => {
    if (err?.status === 401 || (err?.message && err.message.includes('401'))) {
      return new Promise((resolve, reject) => {
        refreshAccessToken(() => {
          apiFunction().then(resolve).catch(reject);
        });
      });
    } else {
      console.error("API error:", err);
      throw err;
    }
  });
}

function refreshAccessToken(callback) {
  if (!tokenClient) {
    alert("Session expired. Please sign in again.");
    window.location.href = 'index.html';
    return;
  }
  tokenClient.callback = (tokenResponse) => {
    if (tokenResponse.access_token) {
      window.accessToken = tokenResponse.access_token;
      localStorage.setItem('accessToken', tokenResponse.access_token);
      if (callback) callback();
    } else {
      alert("Session expired. Please sign in again.");
      localStorage.removeItem('accessToken');
      window.location.href = 'index.html';
    }
  };
  tokenClient.requestAccessToken({ prompt: '' });
}

// Update footer with current image count
function updateFooterImageCount() {
  const footer = document.getElementById('footerImageCount');
  if (footer) {
    footer.textContent = `#${imageCount}`;
  }
}

// Back/Next button functionality
function setupBackNextButtons() {
  const backBtn = document.getElementById('backButton');
  const nextBtn = document.getElementById('nextButton');
  
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (imageCount > 1) {
        imageCount--;
        updateFooterImageCount();
        clearAllInputs();
        fetchAndPrefillRow(imageCount - 1);
      }
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      imageCount++;
      updateFooterImageCount();
      clearAllInputs();
      fetchAndPrefillRow(imageCount - 1);
    });
  }
}

// Clear all form inputs
function clearAllInputs() {
  document.querySelectorAll('input[type="text"]').forEach(input => input.value = '');
  document.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
}

// Write to specific sheet column
function writeToSheet2(rowIndex, colIndex, value) {
  const colLetter = String.fromCharCode(65 + colIndex);
  const range = `${SHEET2_ID}!${colLetter}${rowIndex + 2}:${colLetter}${rowIndex + 2}`;
  const values = [[value]];
  
  return safeApiCall(() =>
    fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=RAW`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${window.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    })
    .then(response => {
      if (!response.ok) throw response;
      return response.json();
    })
  );
}

// Fetch and prefill data from spreadsheet
function fetchAndPrefillRow(rowIndex) {
  safeApiCall(() => doPrefillRow(rowIndex));
}

function doPrefillRow(rowIndex) {
  const range = `${SHEET2_ID}!A${rowIndex + 2}:F${rowIndex + 2}`;
  return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`, {
    headers: {
      "Authorization": `Bearer ${window.accessToken}`,
    }
  })
  .then(response => {
    if (!response.ok) throw response;
    return response.json();
  })
  .then(data => {
    const row = (data.values && data.values[0]) ? data.values[0] : [];
    
    // Prefill form elements (simplified mapping)
    document.getElementById("editableName").value = row[0] || "";
    setSelectValue('reportingSelect', row[1]);
    setSelectValue('observingSelect', row[2]);
    setSelectValue('photographingSelect', row[3]);
    document.getElementById("jeremyDescriptionInput").value = row[4] || "";
    document.getElementById("andreDescriptionInput").value = row[5] || "";
  })
  .catch(error => {
    console.error("Failed to fetch row data:", error);
  });
}

function setSelectValue(selectId, value) {
  const select = document.getElementById(selectId);
  if (select && value) {
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].value === value) {
        select.selectedIndex = i;
        break;
      }
    }
  }
}

// Visual feedback for successful writes
function flashGreen(element) {
  const origColor = element.style.color || getComputedStyle(element).color;
  element.style.color = "#218838";
  setTimeout(() => {
    element.style.color = origColor;
  }, 800);
}

// Setup event handlers for writing to sheet
function setupWriteHandlers() {
  // Editable name (column A)
  const editableName = document.getElementById("editableName");
  editableName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const val = editableName.value.trim();
      writeToSheet2(imageCount - 1, 0, val).then(() => flashGreen(editableName));
    }
  });

  // Dropdown handlers (columns B, C, D)
  const reportingSelect = document.getElementById('reportingSelect');
  const observingSelect = document.getElementById('observingSelect');
  const photographingSelect = document.getElementById('photographingSelect');
  
  reportingSelect.addEventListener("change", () => {
    const val = reportingSelect.value;
    if (val) {
      writeToSheet2(imageCount - 1, 1, val).then(() => flashGreen(reportingSelect));
    }
  });
  
  observingSelect.addEventListener("change", () => {
    const val = observingSelect.value;
    if (val) {
      writeToSheet2(imageCount - 1, 2, val).then(() => flashGreen(observingSelect));
    }
  });
  
  photographingSelect.addEventListener("change", () => {
    const val = photographingSelect.value;
    if (val) {
      writeToSheet2(imageCount - 1, 3, val).then(() => flashGreen(photographingSelect));
    }
  });

  // Text input handlers (columns E, F)
  const jeremyDesc = document.getElementById("jeremyDescriptionInput");
  jeremyDesc.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const val = jeremyDesc.value.trim();
      writeToSheet2(imageCount - 1, 4, val).then(() => flashGreen(jeremyDesc));
    }
  });

  const andreDesc = document.getElementById("andreDescriptionInput");
  andreDesc.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const val = andreDesc.value.trim();
      writeToSheet2(imageCount - 1, 5, val).then(() => flashGreen(andreDesc));
    }
  });
}
