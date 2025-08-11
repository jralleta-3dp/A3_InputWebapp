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
  setupTimeButtons();
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
    footer.textContent = `Image: ${imageCount}`;
  }
  
  const entryNumber = document.getElementById('entryNumber');
  if (entryNumber) {
    entryNumber.textContent = `#${imageCount}`;
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
        fetchAndPrefillRow(imageCount - 1);
      }
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      imageCount++;
      updateFooterImageCount();
      fetchAndPrefillRow(imageCount - 1);
    });
  }
}

// Start/End Time button functionality
function setupTimeButtons() {
  const startButton = document.getElementById("startTimeButton");
  const endButton = document.getElementById("endTimeButton");
  
  if (startButton) {
    startButton.addEventListener("click", () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      safeApiCall(() => writeStartTime(imageCount - 1)).then(() => {
        const startTimeDisplay = document.getElementById("startTimeDisplay");
        if (startTimeDisplay) startTimeDisplay.textContent = `Start: ${timeStr}`;
      }).catch(error => {
        console.error("Failed to write start time:", error);
      });
    });
  }
  
  if (endButton) {
    endButton.addEventListener("click", () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      safeApiCall(() => writeEndTime(imageCount - 1)).then(() => {
        const endTimeDisplay = document.getElementById("endTimeDisplay");
        if (endTimeDisplay) endTimeDisplay.textContent = `End: ${timeStr}`;
      }).catch(error => {
        console.error("Failed to write end time:", error);
      });
    });
  }
}

// Clear all form inputs
function clearAllInputs() {
  document.querySelectorAll('input[type="text"]').forEach(input => input.value = '');
  document.querySelectorAll('textarea').forEach(textarea => textarea.value = '');
  document.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
  document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => checkbox.checked = false);
  
  // Clear time displays
  const startTimeDisplay = document.getElementById("startTimeDisplay");
  const endTimeDisplay = document.getElementById("endTimeDisplay");
  if (startTimeDisplay) startTimeDisplay.textContent = "";
  if (endTimeDisplay) endTimeDisplay.textContent = "";
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
  const range = `${SHEET2_ID}!A${rowIndex + 2}:R${rowIndex + 2}`; // Extended to include all columns
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
    setSelectValue('reportingSelect', row[5]); // Column F (new position)
    setSelectValue('observingSelect', row[6]); // Column G (new position)
    setSelectValue('photographingSelect', row[7]); // Column H (new position)
    document.getElementById("jeremyDescriptionInput").value = row[4] || ""; // Column E (original position)
    setSelectValue('targetoneSelect', row[8]); // Column I (target one dropdown)
    
    // Prefill target one checkboxes (column J)
    const downlinkASAPone = document.getElementById('downlinkASAPone');
    const crewquestionone = document.getElementById('crewquestionone');
    const checkboxValue = row[9] || ""; // Column J
    
    // Clear both checkboxes first (with null checks)
    if (downlinkASAPone) downlinkASAPone.checked = false;
    if (crewquestionone) crewquestionone.checked = false;
    
    // Set the appropriate checkbox based on stored value
    if (checkboxValue === "Downlink ASAP" && downlinkASAPone) {
      downlinkASAPone.checked = true;
    } else if (checkboxValue === "Crew Question" && crewquestionone) {
      crewquestionone.checked = true;
    }
    
    // Prefill target one text input (column K)
    document.getElementById("targetoneTextInput").value = row[10] || ""; // Column K
    
    // Prefill target two select (column L)
    setSelectValue('targettwoSelect', row[11]); // Column L (target two dropdown)
    
    // Prefill target two checkboxes (column M)
    const downlinkASAPtwo = document.getElementById('downlinkASAPtwo');
    const crewquestiontwo = document.getElementById('crewquestiontwo');
    const checkboxValueTwo = row[12] || ""; // Column M
    
    // Clear both target two checkboxes first (with null checks)
    if (downlinkASAPtwo) downlinkASAPtwo.checked = false;
    if (crewquestiontwo) crewquestiontwo.checked = false;
    
    // Set the appropriate checkbox based on stored value
    if (checkboxValueTwo === "Downlink ASAP" && downlinkASAPtwo) {
      downlinkASAPtwo.checked = true;
    } else if (checkboxValueTwo === "Crew Question" && crewquestiontwo) {
      crewquestiontwo.checked = true;
    }
    
    // Prefill target two text input (column N)
    const targettwoTextInput = document.getElementById("targettwoTextInput");
    if (targettwoTextInput) {
      targettwoTextInput.value = row[13] || ""; // Column N
    }
    
    // Prefill target three select (column O)
    setSelectValue('targetthreeSelect', row[14]); // Column O (target three dropdown)
    
    // Prefill target three checkboxes (column P)
    const downlinkASAPthree = document.getElementById('downlinkASAPthree');
    const crewquestionthree = document.getElementById('crewquestionthree');
    const checkboxValueThree = row[15] || ""; // Column P
    
    // Clear both target three checkboxes first (with null checks)
    if (downlinkASAPthree) downlinkASAPthree.checked = false;
    if (crewquestionthree) crewquestionthree.checked = false;
    
    // Set the appropriate checkbox based on stored value
    if (checkboxValueThree === "Downlink ASAP" && downlinkASAPthree) {
      downlinkASAPthree.checked = true;
    } else if (checkboxValueThree === "Crew Question" && crewquestionthree) {
      crewquestionthree.checked = true;
    }
    
    // Prefill target three text input (column Q)
    const targetthreeTextInput = document.getElementById("targetthreeTextInput");
    if (targetthreeTextInput) {
      targetthreeTextInput.value = row[16] || ""; // Column Q
    }
    
    // Prefill time displays if data exists
    const startTimeDisplay = document.getElementById("startTimeDisplay");
    const endTimeDisplay = document.getElementById("endTimeDisplay");
    
    if (startTimeDisplay && row[1]) {
      const startTime = new Date(row[1]);
      const timeStr = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      startTimeDisplay.textContent = `Start: ${timeStr}`;
    } else if (startTimeDisplay) {
      startTimeDisplay.textContent = "";
    }
    
    if (endTimeDisplay && row[2]) {
      const endTime = new Date(row[2]);
      const timeStr = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      endTimeDisplay.textContent = `End: ${timeStr}`;
    } else if (endTimeDisplay) {
      endTimeDisplay.textContent = "";
    }
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

// Function to write Start Time to Sheet2 (adapting from newpage.html)
function writeStartTime(rowIndex) {
  const nowGMT = new Date().toISOString();
  const targetRow = rowIndex + 2; // Adjusting for Sheet2 indexing
  
  // For imaging.html, we'll write start time to column B (index 1)
  const colIndex = 1;
  const colLetter = String.fromCharCode(65 + colIndex);
  const range = `${SHEET2_ID}!${colLetter}${targetRow}:${colLetter}${targetRow}`;
  const values = [[nowGMT]];
  
  return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=RAW`, {
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
  });
}

// Function to write End Time to Sheet2 (adapting from newpage.html)
function writeEndTime(rowIndex) {
  const nowGMT = new Date().toISOString();
  const targetRow = rowIndex + 2; // Adjusting for Sheet2 indexing
  
  // For imaging.html, we'll write end time to column C (index 2)
  const colIndex = 2;
  const colLetter = String.fromCharCode(65 + colIndex);
  const range = `${SHEET2_ID}!${colLetter}${targetRow}:${colLetter}${targetRow}`;
  const values = [[nowGMT]];
  
  return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=RAW`, {
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
  });
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
      writeToSheet2(imageCount - 1, 5, val).then(() => flashGreen(reportingSelect));
    }
  });
  
  observingSelect.addEventListener("change", () => {
    const val = observingSelect.value;
    if (val) {
      writeToSheet2(imageCount - 1, 6, val).then(() => flashGreen(observingSelect));
    }
  });
  
  photographingSelect.addEventListener("change", () => {
    const val = photographingSelect.value;
    if (val) {
      writeToSheet2(imageCount - 1, 7, val).then(() => flashGreen(photographingSelect));
    }
  });

  // Text input handlers (columns E, F)
  const jeremyDesc = document.getElementById("jeremyDescriptionInput");
  jeremyDesc.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const val = jeremyDesc.value.trim();
      writeToSheet2(imageCount - 1, 4, val).then(() => flashGreen(jeremyDesc)); // Column E (back to original)
    }
  });

  // Target One Select handler (column I)
  const targetoneSelect = document.getElementById('targetoneSelect');
  targetoneSelect.addEventListener("change", () => {
    const val = targetoneSelect.value;
    if (val) {
      writeToSheet2(imageCount - 1, 8, val).then(() => flashGreen(targetoneSelect));
    }
  });

  // Target One Checkbox handlers (column J) - Only one selectable at a time
  const downlinkASAPone = document.getElementById('downlinkASAPone');
  const crewquestionone = document.getElementById('crewquestionone');
  
  if (downlinkASAPone) {
    downlinkASAPone.addEventListener("change", () => {
      if (downlinkASAPone.checked) {
        if (crewquestionone) crewquestionone.checked = false; // Uncheck the other one
        writeToSheet2(imageCount - 1, 9, downlinkASAPone.value).then(() => flashGreen(downlinkASAPone.parentElement));
      } else {
        // If unchecked, clear the column
        writeToSheet2(imageCount - 1, 9, "").then(() => flashGreen(downlinkASAPone.parentElement));
      }
    });
  }
  
  if (crewquestionone) {
    crewquestionone.addEventListener("change", () => {
      if (crewquestionone.checked) {
        if (downlinkASAPone) downlinkASAPone.checked = false; // Uncheck the other one
        writeToSheet2(imageCount - 1, 9, crewquestionone.value).then(() => flashGreen(crewquestionone.parentElement));
      } else {
        // If unchecked, clear the column
        writeToSheet2(imageCount - 1, 9, "").then(() => flashGreen(crewquestionone.parentElement));
      }
    });
  }

  // Target One Text Input handler (column K)
  const targetoneTextInput = document.getElementById("targetoneTextInput");
  targetoneTextInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const val = targetoneTextInput.value.trim();
      writeToSheet2(imageCount - 1, 10, val).then(() => flashGreen(targetoneTextInput)); // Column K (index 10)
    }
  });

  // Target Two Select handler (column L)
  const targettwoSelect = document.getElementById('targettwoSelect');
  if (targettwoSelect) {
    targettwoSelect.addEventListener("change", () => {
      const val = targettwoSelect.value;
      if (val) {
        writeToSheet2(imageCount - 1, 11, val).then(() => flashGreen(targettwoSelect)); // Column L (index 11)
      }
    });
  }

  // Target Two Checkbox handlers (column M) - Only one selectable at a time
  const downlinkASAPtwo = document.getElementById('downlinkASAPtwo');
  const crewquestiontwo = document.getElementById('crewquestiontwo');
  
  if (downlinkASAPtwo) {
    downlinkASAPtwo.addEventListener("change", () => {
      if (downlinkASAPtwo.checked) {
        if (crewquestiontwo) crewquestiontwo.checked = false; // Uncheck the other one
        writeToSheet2(imageCount - 1, 12, downlinkASAPtwo.value).then(() => flashGreen(downlinkASAPtwo.parentElement)); // Column M (index 12)
      } else {
        // If unchecked, clear the column
        writeToSheet2(imageCount - 1, 12, "").then(() => flashGreen(downlinkASAPtwo.parentElement));
      }
    });
  }
  
  if (crewquestiontwo) {
    crewquestiontwo.addEventListener("change", () => {
      if (crewquestiontwo.checked) {
        if (downlinkASAPtwo) downlinkASAPtwo.checked = false; // Uncheck the other one
        writeToSheet2(imageCount - 1, 12, crewquestiontwo.value).then(() => flashGreen(crewquestiontwo.parentElement)); // Column M (index 12)
      } else {
        // If unchecked, clear the column
        writeToSheet2(imageCount - 1, 12, "").then(() => flashGreen(crewquestiontwo.parentElement));
      }
    });
  }

  // Target Two Text Input handler (column N)
  const targettwoTextInput = document.getElementById("targettwoTextInput");
  if (targettwoTextInput) {
    targettwoTextInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const val = targettwoTextInput.value.trim();
        writeToSheet2(imageCount - 1, 13, val).then(() => flashGreen(targettwoTextInput)); // Column N (index 13)
      }
    });
  }

  // Target Three Select handler (column O)
  const targetthreeSelect = document.getElementById('targetthreeSelect');
  if (targetthreeSelect) {
    targetthreeSelect.addEventListener("change", () => {
      const val = targetthreeSelect.value;
      if (val) {
        writeToSheet2(imageCount - 1, 14, val).then(() => flashGreen(targetthreeSelect)); // Column O (index 14)
      }
    });
  }

  // Target Three Checkbox handlers (column P) - Only one selectable at a time
  const downlinkASAPthree = document.getElementById('downlinkASAPthree');
  const crewquestionthree = document.getElementById('crewquestionthree');
  
  if (downlinkASAPthree) {
    downlinkASAPthree.addEventListener("change", () => {
      if (downlinkASAPthree.checked) {
        if (crewquestionthree) crewquestionthree.checked = false; // Uncheck the other one
        writeToSheet2(imageCount - 1, 15, downlinkASAPthree.value).then(() => flashGreen(downlinkASAPthree.parentElement)); // Column P (index 15)
      } else {
        // If unchecked, clear the column
        writeToSheet2(imageCount - 1, 15, "").then(() => flashGreen(downlinkASAPthree.parentElement));
      }
    });
  }
  
  if (crewquestionthree) {
    crewquestionthree.addEventListener("change", () => {
      if (crewquestionthree.checked) {
        if (downlinkASAPthree) downlinkASAPthree.checked = false; // Uncheck the other one
        writeToSheet2(imageCount - 1, 15, crewquestionthree.value).then(() => flashGreen(crewquestionthree.parentElement)); // Column P (index 15)
      } else {
        // If unchecked, clear the column
        writeToSheet2(imageCount - 1, 15, "").then(() => flashGreen(crewquestionthree.parentElement));
      }
    });
  }

  // Target Three Text Input handler (column Q)
  const targetthreeTextInput = document.getElementById("targetthreeTextInput");
  if (targetthreeTextInput) {
    targetthreeTextInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const val = targetthreeTextInput.value.trim();
        writeToSheet2(imageCount - 1, 16, val).then(() => flashGreen(targetthreeTextInput)); // Column Q (index 16)
      }
    });
  }

  // Plus button handler for inserting a new row
  const addRowButton = document.getElementById("addRowButton");
  if (addRowButton) {
    addRowButton.addEventListener("click", () => {
      console.log("Plus button clicked, current imageCount:", imageCount); // Debugging log
      // Insert below current row (imageCount instead of imageCount - 1)
      insertRowBelow(imageCount).then(() => {
        // Increment imageCount to move to the newly inserted row
        imageCount++;
        updateFooterImageCount();
        
        // Clear all inputs for the new row
        clearAllInputs();
        
        // Fetch and display the new empty row data
        fetchAndPrefillRow(imageCount - 1);
        
        // Visual feedback
        flashGreen(addRowButton);
        console.log("Row inserted successfully and moved to new row!");
      }).catch(error => {
        console.error("Error inserting row:", error);
        
        // Show user-friendly error message
        const errorMsg = error.message || "Failed to insert row";
        alert(`Error: ${errorMsg}`);
        
        // Flash red on error
        flashRed(addRowButton);
      });
    });
  }
}

// Helper function to clear all inputs for new row
function clearAllInputs() {
  // Clear all dropdowns
  const dropdowns = ["targetoneDropdown", "targettwoDropdown", "targetthreeDropdown"];
  dropdowns.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = "";
  });
  
  // Clear all checkboxes
  const checkboxes = ["targetoneCheck", "targettwoCheck", "targetthreeCheck"];
  checkboxes.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.checked = false;
  });
  
  // Clear all text inputs
  const textInputs = ["targetoneTextInput", "targettwoTextInput", "targetthreeTextInput"];
  textInputs.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = "";
  });
}

// Function to insert a new row in the Google Sheet (copied exactly from newpage.html)
function insertRowBelow(targetRowIndex) {
  return safeApiCall(() => {
      const sheetId = 479827154; // Sheet2 ID extracted from the Google Sheets URL
      const insertRowIndex = targetRowIndex + 1;

      const requestBody = {
          requests: [
              {
                  insertDimension: {
                      range: {
                          sheetId: sheetId,
                          dimension: "ROWS",
                          startIndex: insertRowIndex,
                          endIndex: insertRowIndex + 1,
                      },
                      inheritFromBefore: true,
                  },
              },
          ],
      };

      return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
          method: "POST",
          headers: {
              "Authorization": `Bearer ${window.accessToken}`,
              "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
      })
          .then((response) => {
              if (!response.ok) throw response;
              return response.json();
          })
          .then((data) => {
              console.log("Row inserted successfully in Sheet2:", data);
              return data;
          });
  });
}

// Helper function for red flash feedback on errors
function flashRed(element) {
  if (!element) return;
  
  const originalBg = element.style.backgroundColor;
  element.style.backgroundColor = "#ff6b6b";
  element.style.transition = "background-color 0.2s ease";
  
  setTimeout(() => {
    element.style.backgroundColor = originalBg;
    setTimeout(() => {
      element.style.transition = "";
    }, 200);
  }, 200);
}

// Initialize the display when the page loads
document.addEventListener('DOMContentLoaded', function() {
  // Initialize the counter display
  updateFooterImageCount();
  
  console.log("Page loaded, imageCount initialized to:", imageCount);
});
