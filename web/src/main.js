import './style.css';

const paths = {
  scan: '<path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3M7 7h10v10H7z"/>',
  layers: '<path d="m12 3 10 6-10 6L2 9l10-6Zm-9 11 9 5 9-5M3 18l9 5 9-5"/>',
  wand: '<path d="m4 20 12-12 4 4L8 24M14 3v4m-2-2h4M5 6v4M3 8h4m12 8v4m-2-2h4" transform="translate(0 -2)"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  book: '<path d="M12 5v16M12 5C8 2 4 3 2 4v15c4-2 7-1 10 2 3-3 6-4 10-2V4c-2-1-6-2-10 1Z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
const icon = (name) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.scan}</svg>`;
const demos = [
  { id: 'detection', number: '01', icon: 'scan', title: 'Nhận diện vật thể', model: 'YOLO26', subtitle: 'Tìm và gọi tên những gì có trong ảnh.', description: 'Xác định vị trí và phân loại vật thể bằng khung bao, kèm độ tin cậy cho từng dự đoán.', sample: 'zebras', result: 'zebras-result.jpg' },
  { id: 'segmentation', number: '02', icon: 'layers', title: 'Phân vùng ảnh', model: 'DeepLabV3', subtitle: 'Hiểu bức ảnh đến từng điểm ảnh.', description: 'Gán nhãn cho từng điểm ảnh với 21 lớp ngữ nghĩa, sau đó phủ màu để quan sát từng vùng.', sample: 'cycling', result: 'cycling-result.png' },
  { id: 'style', number: '03', icon: 'wand', title: 'Chuyển phong cách', model: 'Neural Style Transfer', subtitle: 'Biến khoảnh khắc thành tác phẩm.', description: 'Giữ nội dung bức ảnh và tái tạo nó bằng màu sắc, nét vẽ của phong cách nghệ thuật đã chọn.', sample: 'monalisa', result: 'monalisa-result.jpg' },
];
const samples = [
  { id: 'zebras', title: 'Thiên nhiên', file: 'zebras.jpg' },
  { id: 'cycling', title: 'Thể thao', file: 'cycling.jpg' },
  { id: 'monalisa', title: 'Nghệ thuật', file: 'monalisa.jpg' },
];
const styles = { starry_night: 'Đêm đầy sao', feathers: 'Lông vũ', candy: 'Kẹo ngọt', mosaic: 'Khảm màu', udnie: 'Udnie', the_scream: 'Tiếng thét', la_muse: 'Nàng thơ' };
let apiUrl = localStorage.getItem('vision-api') ?? import.meta.env.VITE_API_URL ?? '';
let active = demos[0], selected = samples[0], uploaded = null, previewUrl = '', result = null, busy = false, compare = false;
let confidence = 0.25, opacity = 0.6, style = 'starry_night';
const $ = (s) => document.querySelector(s);
const source = () => previewUrl || `/samples/${selected.file}`;
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

$('#app').innerHTML = `
  <aside class="sidebar">
    <a class="brand" href="/" aria-label="Vision Lab trang chủ"><span class="brand-mark">V<span>•</span></span><span>vision<span class="brand-light">lab</span><small>IMAGE PROCESSING STUDIO</small></span></a>
    <div class="nav-caption">KHÔNG GIAN LÀM VIỆC</div>
    <nav aria-label="Các demo">${demos.map(d => `<button class="nav-item" data-demo="${d.id}">${icon(d.icon)}<span>${d.title}</span><span class="nav-index">${d.number}</span></button>`).join('')}</nav>
    <div class="sidebar-note"><span class="note-symbol">✳</span><h3>Học bằng cách khám phá.</h3><p>Một bức ảnh. Ba góc nhìn.<br>Khám phá sức mạnh của thị giác máy tính.</p><span class="chapter">CHƯƠNG 11 <span>↗</span></span></div>
    <button class="help-link" id="guide">${icon('book')} Hướng dẫn sử dụng</button>
    <div class="sidebar-bottom"><span class="avatar">CV</span><div>Computer Vision<small>Interactive playground</small></div><span class="online-dot"></span></div>
  </aside>
  <div class="main-shell">
    <header><div class="breadcrumb">Phòng thực hành <span>/</span> <strong>Xử lý ảnh</strong></div><button id="connection" class="connection"><span class="online-dot"></span><span id="connection-label"></span>${icon('settings')}</button></header>
    <main>
      <div class="intro"><div><div class="eyebrow"><span></span> COMPUTER VISION PLAYGROUND</div><h1>Nhìn thế giới <span>theo cách khác.</span></h1><p>Khám phá các mô hình AI qua những thử nghiệm trực quan của riêng bạn.</p></div><span class="intro-badge">3 mô hình <span>·</span> Vô vàn khám phá</span></div>
      <section class="demo-grid" aria-label="Chọn mô hình">${demos.map(d => `<button class="demo-card" data-demo="${d.id}"><div class="card-top"><span class="card-icon">${icon(d.icon)}</span><span class="model-tag">${d.model}</span><span class="card-number">${d.number}</span></div><h2>${d.title}</h2><p>${d.subtitle}</p><span class="card-arrow">↗</span></button>`).join('')}</section>
      <section class="workspace">
        <div class="workspace-heading"><div><span class="section-kicker">BÀN THỰC HÀNH</span><h2 id="workspace-title"></h2></div><span class="step-badge">Tải ảnh <span>→</span> Tùy chỉnh <span>→</span> Khám phá</span></div>
        <div class="work-grid">
          <div class="controls">
            <h3><span class="step-number">1</span> Chọn ảnh đầu vào</h3>
            <button class="dropzone" id="dropzone">${icon('upload')}<strong>Kéo thả ảnh vào đây</strong><span>hoặc <em>chọn từ thiết bị</em></span><small>JPG, PNG, WEBP · Tối đa 10 MB</small></button>
            <input id="file" type="file" accept="image/jpeg,image/png,image/webp" hidden />
            <div class="sample-heading">Hoặc thử với ảnh mẫu <span>↓</span></div>
            <div class="samples">${samples.map(s => `<button class="sample" data-sample="${s.id}" aria-label="Ảnh mẫu ${s.title}"><img src="/samples/${s.file}" alt="${s.title}"/><span>${s.title}</span></button>`).join('')}</div>
            <div class="control-divider"></div><h3><span class="step-number">2</span> Tùy chỉnh mô hình</h3>
            <div id="parameters"></div>
            <div class="model-info">${icon('scan')}<p id="model-description"></p></div>
            <button class="run-button" id="run">${icon('scan')}<span>Chạy mô hình</span>${icon('arrow')}</button>
            <button class="sample-run" id="sample-run">Xem kết quả mẫu có sẵn ↗</button>
            <p class="privacy-note" id="mode-note"></p>
          </div>
          <div class="preview-panel">
            <div class="preview-toolbar"><div class="view-tabs"><button id="original-tab" class="active">Ảnh gốc</button><button id="result-tab" disabled>Kết quả</button></div><button id="compare" class="text-button" disabled>⇆ So sánh</button></div>
            <div class="canvas" id="canvas"><div class="image-stage" id="image-stage"><img id="preview" alt="Ảnh đầu vào"/><img id="overlay" alt="Ảnh kết quả để so sánh" hidden/><div class="compare-line" hidden></div></div><span class="canvas-label" id="canvas-label">ẢNH ĐẦU VÀO</span><div class="loading" hidden><span class="spinner"></span><strong>Đang khám phá bức ảnh…</strong><span>Lần chạy đầu có thể lâu hơn do tải mô hình.</span></div></div>
            <div class="compare-slider" hidden><label for="split">Kéo để so sánh ảnh gốc và kết quả</label><input id="split" type="range" min="0" max="100" value="50"/></div>
            <div class="image-meta"><span id="filename"></span><span id="dimensions"></span></div>
            <div id="status" role="status" aria-live="polite"></div>
            <div class="result-footer"><span id="result-summary">Mọi khám phá bắt đầu từ một bức ảnh.</span><button id="download" class="download-button" disabled>${icon('download')} Tải kết quả</button></div>
            <div id="result-details" class="result-details"></div>
          </div>
        </div>
      </section>
      <div class="bottom-note"><span>✳ <strong>Từ điểm ảnh đến trí tuệ.</strong> Thử ảnh khác nhau để thấy cách AI cảm nhận thế giới.</span><span>Built for curiosity.</span></div>
    </main>
    <footer><span>Vision Lab <span> / </span> Chương 11 · Xử lý ảnh</span><span>Học hỏi. Thử nghiệm. Sáng tạo.</span></footer>
  </div>
  <dialog id="settings-dialog"><form id="settings-form"><div class="dialog-heading"><h2>Kết nối mô hình</h2><button type="button" class="icon-button" data-close="settings-dialog" aria-label="Đóng">${icon('close')}</button></div><p>Nhập địa chỉ API Python để xử lý ảnh của bạn. Khi chưa kết nối, bạn vẫn có thể xem các kết quả mẫu đã lưu.</p><label for="api-url">Địa chỉ API</label><input id="api-url" type="url" placeholder="https://your-api.example.com"/><small>Chạy trên máy: http://localhost:8000. Địa chỉ được lưu trên trình duyệt này.</small><div id="connection-status" role="status"></div><div class="dialog-actions"><button type="button" class="secondary-button" id="check-api">Kiểm tra kết nối</button><button type="submit" class="primary-button">Lưu kết nối</button></div></form></dialog>
  <dialog id="guide-dialog"><div class="dialog-heading"><h2>Bắt đầu khám phá</h2><button class="icon-button" data-close="guide-dialog" aria-label="Đóng">${icon('close')}</button></div><ol><li>Chọn một trong ba mô hình ở đầu trang.</li><li>Tải ảnh của bạn hoặc chọn một ảnh mẫu.</li><li>Điều chỉnh tham số, sau đó chọn <strong>Chạy mô hình</strong>.</li><li>Xem kết quả, kéo thanh so sánh hoặc tải ảnh về máy.</li></ol><p><strong>Chưa có API?</strong> Chọn “Xem kết quả mẫu có sẵn” ở bất kỳ demo nào. Đây là ảnh kết quả lưu sẵn từ dự án, không phải lần suy luận mới.</p><p>Để chạy cả ba mô hình với ảnh bất kỳ, khởi động API Python theo README và thiết lập địa chỉ trong “Kết nối mô hình”. Ảnh tải lên được xử lý trong bộ nhớ, không lưu vào thư viện.</p></dialog>
`;

function message(text = '', error = false) { $('#status').textContent = text; $('#status').className = error ? 'error' : ''; }
function updateConnection() {
  $('#connection-label').textContent = apiUrl ? 'Đã cấu hình API' : 'Chế độ xem mẫu';
  $('#connection').classList.toggle('configured', Boolean(apiUrl));
  $('#mode-note').textContent = apiUrl ? 'Ảnh được gửi đến API bạn đã cấu hình.' : 'Kết nối API để chạy mô hình trên ảnh của bạn.';
}
function clearResult() {
  result = null; compare = false;
  $('#result-tab').disabled = $('#download').disabled = $('#compare').disabled = true;
  $('#result-details').replaceChildren();
  $('#result-summary').textContent = 'Mọi khám phá bắt đầu từ một bức ảnh.';
  message(); showOriginal();
}
function showOriginal() {
  compare = false; $('#preview').src = source(); $('#preview').alt = 'Ảnh đầu vào';
  $('#overlay').hidden = $('.compare-line').hidden = $('.compare-slider').hidden = true;
  $('#original-tab').classList.add('active'); $('#result-tab').classList.remove('active');
  $('#compare').classList.remove('active'); $('#canvas-label').textContent = 'ẢNH ĐẦU VÀO';
}
function showResult() {
  if (!result) return;
  compare = false; $('#preview').src = result.image; $('#preview').alt = 'Kết quả ' + active.title;
  $('#overlay').hidden = $('.compare-line').hidden = $('.compare-slider').hidden = true;
  $('#original-tab').classList.remove('active'); $('#result-tab').classList.add('active');
  $('#compare').classList.remove('active'); $('#canvas-label').textContent = result.saved ? 'KẾT QUẢ MẪU ĐÃ LƯU' : 'KẾT QUẢ MÔ HÌNH';
}
function setSample(id) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = ''; uploaded = null; $('#file').value = '';
  selected = samples.find(s => s.id === id);
  document.querySelectorAll('[data-sample]').forEach(b => b.classList.toggle('active', b.dataset.sample === id));
  $('#filename').textContent = selected.file; clearResult();
}
function parameters() {
  $('#parameters').innerHTML = active.id === 'style'
    ? `<label class="field-label" for="style">Phong cách nghệ thuật</label><select id="style">${Object.entries(styles).map(([id, name]) => `<option value="${id}" ${style === id ? 'selected' : ''}>${name}</option>`).join('')}</select><p class="parameter-help">Mỗi phong cách sử dụng một mô hình đã huấn luyện riêng.</p>`
    : `<div class="range-heading"><label for="parameter">${active.id === 'detection' ? 'Ngưỡng tin cậy' : 'Độ phủ lớp màu'}</label><output id="parameter-value">${Math.round((active.id === 'detection' ? confidence : opacity) * 100)}%</output></div><input id="parameter" type="range" min="${active.id === 'detection' ? 5 : 0}" max="100" value="${(active.id === 'detection' ? confidence : opacity) * 100}"/><div class="range-ticks"><span>${active.id === 'detection' ? '5%' : '0%'}</span><span>100%</span></div><p class="parameter-help">${active.id === 'detection' ? 'Tăng ngưỡng để chỉ giữ dự đoán có độ tin cậy cao.' : 'Điều chỉnh mức độ hiển thị của vùng phân loại trên ảnh gốc.'}</p>`;
  $('#parameter')?.addEventListener('input', e => {
    const v = Number(e.target.value); $('#parameter-value').textContent = `${v}%`;
    if (active.id === 'detection') confidence = v / 100; else opacity = v / 100;
    clearResult();
  });
  $('#style')?.addEventListener('change', e => { style = e.target.value; clearResult(); });
}
function selectDemo(id) {
  if (busy) return;
  active = demos.find(d => d.id === id);
  document.querySelectorAll('[data-demo]').forEach(b => { const on = b.dataset.demo === id; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
  $('#workspace-title').textContent = active.title; $('#model-description').textContent = active.description;
  $('#sample-run').hidden = !active.result; parameters(); setSample(active.sample);
}
async function loadFile(file) {
  if (!file || busy) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return message('Vui lòng chọn ảnh JPG, PNG hoặc WEBP.', true);
  if (file.size > 10 * 1024 * 1024) return message('Ảnh quá lớn. Vui lòng chọn ảnh dưới 10 MB.', true);
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    if (img.naturalWidth * img.naturalHeight > 25000000) throw new Error('Ảnh vượt quá 25 triệu điểm ảnh. Hãy giảm kích thước trước khi tải lên.');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = url; uploaded = file;
    document.querySelectorAll('[data-sample]').forEach(b => b.classList.remove('active'));
    $('#filename').textContent = file.name; clearResult();
  } catch (err) { URL.revokeObjectURL(url); message(err.message.includes('25 triệu') ? err.message : 'Không đọc được ảnh. Vui lòng chọn tệp ảnh hợp lệ.', true); }
}
function setBusy(value) {
  busy = value; $('.loading').hidden = !value; $('#canvas').setAttribute('aria-busy', String(value));
  document.querySelectorAll('[data-demo], [data-sample], #run, #sample-run, #parameter, #style, #dropzone, #connection').forEach(b => b.disabled = value);
  $('#run span').textContent = value ? 'Đang xử lý…' : 'Chạy mô hình';
}
function present(data) {
  result = data; $('#result-tab').disabled = $('#download').disabled = $('#compare').disabled = false;
  $('#result-summary').textContent = data.saved ? 'Ảnh kết quả đã lưu từ dự án Python' : `${data.model} · ${data.elapsed_seconds.toFixed(2)} giây · ${data.width} × ${data.height} px`;
  $('#result-details').innerHTML = (data.items || []).map(i => `<span class="result-chip">${escape(i.label)} <strong>${escape(i.value)}</strong></span>`).join('');
  showResult();
}
async function run() {
  if (busy) return;
  if (!apiUrl) { $('#api-url').value = apiUrl; $('#settings-dialog').showModal(); return; }
  clearResult(); setBusy(true);
  try {
    const file = uploaded || await fetch(source()).then(r => { if (!r.ok) throw new Error('Không tải được ảnh mẫu.'); return r.blob(); });
    const form = new FormData(); form.append('file', file, uploaded?.name || selected.file);
    form.append('demo', active.id); form.append('confidence', confidence); form.append('opacity', opacity); form.append('style', style);
    const response = await fetch(`${apiUrl}/predict`, { method: 'POST', body: form, signal: AbortSignal.timeout(300000) });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Tham số không hợp lệ hoặc API không xử lý được ảnh.');
    if (!/^data:image\/(png|jpeg);base64,/.test(data.image) || !Number.isFinite(data.elapsed_seconds)) throw new Error('API trả về kết quả không hợp lệ.');
    present(data); message('Xử lý hoàn tất. Bạn có thể so sánh và tải kết quả.');
  } catch (err) { message(err.name === 'TimeoutError' ? 'API chưa trả kết quả sau 5 phút. Hãy kiểm tra máy chủ rồi thử lại.' : err instanceof TypeError ? 'Không kết nối được API. Kiểm tra địa chỉ, HTTPS và cấu hình CORS của máy chủ.' : err.message, true); }
  finally { setBusy(false); }
}
document.querySelectorAll('[data-demo]').forEach(b => b.addEventListener('click', () => selectDemo(b.dataset.demo)));
document.querySelectorAll('[data-sample]').forEach(b => b.addEventListener('click', () => setSample(b.dataset.sample)));
$('#dropzone').onclick = () => $('#file').click(); $('#file').onchange = e => loadFile(e.target.files[0]);
for (const name of ['dragenter', 'dragover']) $('#dropzone').addEventListener(name, e => { e.preventDefault(); $('#dropzone').classList.add('dragging'); });
for (const name of ['dragleave', 'drop']) $('#dropzone').addEventListener(name, e => { e.preventDefault(); $('#dropzone').classList.remove('dragging'); if (name === 'drop') loadFile(e.dataTransfer.files[0]); });
$('#preview').onload = () => { $('#dimensions').textContent = `${$('#preview').naturalWidth} × ${$('#preview').naturalHeight} px`; };
$('#preview').onerror = () => message('Không tải được ảnh. Vui lòng thử chọn ảnh khác.', true);
$('#run').onclick = run; $('#original-tab').onclick = showOriginal; $('#result-tab').onclick = showResult;
$('#sample-run').onclick = () => {
  if (busy || !active.result) return;
  setSample(active.sample);
  present({ image: `/samples/${active.result}`, saved: true });
  message('Đây là kết quả mẫu đã lưu; các tham số hiện tại không áp dụng. Kết nối API để tạo kết quả mới.');
};
$('#compare').onclick = () => {
  if (!result) return;
  if (compare) return showResult();
  showOriginal(); compare = true; $('#overlay').src = result.image;
  $('#overlay').hidden = $('.compare-line').hidden = $('.compare-slider').hidden = false;
  $('#canvas-label').textContent = 'GỐC ← → KẾT QUẢ'; $('#compare').classList.add('active'); $('#split').value = 50; split(50);
};
function split(value) { $('#overlay').style.clipPath = `inset(0 0 0 ${value}%)`; $('.compare-line').style.left = `${value}%`; }
$('#split').oninput = e => split(e.target.value);
$('#download').onclick = () => { if (!result) return; const a = document.createElement('a'); a.href = result.image; a.download = `visionlab-${active.id}.${result.saved && result.image.endsWith('.jpg') ? 'jpg' : 'png'}`; a.click(); };
$('#connection').onclick = () => { $('#api-url').value = apiUrl; $('#connection-status').textContent = ''; $('#settings-dialog').showModal(); };
$('#guide').onclick = () => $('#guide-dialog').showModal();
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => document.getElementById(b.dataset.close).close());
function parseApi() {
  const value = $('#api-url').value.trim().replace(/\/+$/, '');
  if (!value) return '';
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Vui lòng nhập địa chỉ HTTP/HTTPS không chứa tài khoản, query hoặc fragment.');
  if (location.protocol === 'https:' && url.protocol === 'http:') throw new Error('Website HTTPS cần kết nối với API HTTPS.');
  return value;
}
$('#settings-form').onsubmit = e => {
  e.preventDefault();
  try { apiUrl = parseApi(); localStorage.setItem('vision-api', apiUrl); updateConnection(); $('#settings-dialog').close(); }
  catch (err) { $('#connection-status').textContent = err.message; }
};
$('#check-api').onclick = async () => {
  $('#check-api').disabled = true; $('#connection-status').textContent = 'Đang kiểm tra…';
  try { const url = parseApi(); if (!url) throw new Error('Nhập địa chỉ API trước khi kiểm tra.'); const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(10000) }); const data = await r.json(); if (!r.ok || data.status !== 'ok') throw new Error('API chưa sẵn sàng.'); $('#connection-status').textContent = 'Kết nối thành công. Nhấn Lưu kết nối để sử dụng.'; }
  catch (err) { $('#connection-status').textContent = `Không kết nối được: ${err.message}`; }
  finally { $('#check-api').disabled = false; }
};
updateConnection(); selectDemo('detection');
