const form = document.getElementById('convert-form');
const tabs = document.querySelectorAll('.tab');
const tabPanels = { zip: document.getElementById('tab-zip'), repo: document.getElementById('tab-repo') };
const dropzone = document.getElementById('dropzone');
const dropzoneLabel = document.getElementById('dropzone-label');
const zipInput = document.getElementById('zip-input');
const repoInput = document.getElementById('repo-input');
const convertBtn = document.getElementById('convert-btn');
const resultPanel = document.getElementById('result-panel');
const resultType = document.getElementById('result-type');
const resultFallback = document.getElementById('result-fallback');
const logEl = document.getElementById('log');
const actionsEl = document.getElementById('actions');
const downloadLink = document.getElementById('download-link');
const previewLink = document.getElementById('preview-link');
const previewFrame = document.getElementById('preview-frame');

let activeTab = 'zip';

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    activeTab = tab.dataset.tab;
    tabs.forEach((t) => t.classList.toggle('active', t === tab));
    tabPanels.zip.hidden = activeTab !== 'zip';
    tabPanels.repo.hidden = activeTab !== 'repo';
  });
});

dropzone.addEventListener('click', () => zipInput.click());
['dragenter', 'dragover'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  })
);
['dragleave', 'drop'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  })
);
dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file) {
    zipInput.files = e.dataTransfer.files;
    dropzoneLabel.textContent = file.name;
  }
});
zipInput.addEventListener('change', () => {
  if (zipInput.files[0]) dropzoneLabel.textContent = zipInput.files[0].name;
});

function renderLog(lines) {
  logEl.innerHTML = '';
  for (const line of lines) {
    const div = document.createElement('div');
    if (/fail|error/i.test(line)) div.className = 'err';
    div.textContent = line;
    logEl.appendChild(div);
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  convertBtn.disabled = true;
  convertBtn.textContent = 'Converting...';
  resultPanel.hidden = false;
  resultFallback.hidden = true;
  actionsEl.hidden = true;
  previewFrame.hidden = true;
  resultType.textContent = 'working...';
  renderLog(['Uploading and analyzing project...']);

  try {
    const body = new FormData();
    if (activeTab === 'zip') {
      if (!zipInput.files[0]) throw new Error('Choose a .zip file first');
      body.append('zip', zipInput.files[0]);
    } else {
      if (!repoInput.value.trim()) throw new Error('Enter a GitHub repo URL first');
      body.append('repoUrl', repoInput.value.trim());
    }

    const resp = await fetch('/api/convert', { method: 'POST', body });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Conversion failed');

    resultType.textContent = data.detected;
    resultFallback.hidden = !data.fellBack;
    renderLog(data.log || []);

    downloadLink.href = data.downloadUrl;
    previewLink.href = data.previewUrl;
    previewFrame.src = data.previewUrl;
    previewFrame.hidden = false;
    actionsEl.hidden = false;
  } catch (err) {
    resultType.textContent = 'error';
    renderLog([String(err.message || err)]);
  } finally {
    convertBtn.disabled = false;
    convertBtn.textContent = 'Convert';
  }
});
