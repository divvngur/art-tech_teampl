// ── FaceController.js ────────────────────────────────
// ml5 FaceMesh 래퍼: 싱글톤 패턴

window.FaceController = (function() {
  let _faceMesh  = null;
  let _video     = null;
  let _results   = [];
  let _ready     = false;
  let _sk        = null;          // p5 인스턴스 (좌표 변환용)
  let _canvasW   = 0;
  let _canvasH   = 0;
  let _videoW    = 640;
  let _videoH    = 480;

  // 공개 상태
  const state = {
    mouthOpen:    false,
    mouthCenter:  { x: -999, y: -999 },
    mouthRadius:  55,
    faceBox:      null,   // { x, y, w, h }
    ready:        false,
    debug:        false,
  };

  // 입 벌림 threshold (정규화 좌표 기준)
  const MOUTH_OPEN_THRESHOLD = 0.022; // 0~1 범위

  // ── 초기화 ─────────────────────────────────────────
  function init(video, sk, onReady) {
    const sameVideo = _video === video;

    _video  = video;
    _sk     = sk;
    _videoW = video.videoWidth  || video.width  || 640;
    _videoH = video.videoHeight || video.height || 480;

    if (_faceMesh && sameVideo) {
      _ready = true;
      state.ready = true;
      onReady && onReady();
      return;
    }

    _faceMesh = null;
    _results = [];
    _ready = false;
    state.ready = false;

    const createFaceMesh = ml5.facemesh || ml5.faceMesh;

    if (!createFaceMesh) {
      console.error('ml5 FaceMesh API를 찾을 수 없습니다.');
      return;
    }

    // ml5 v0.x API
    try {
      _faceMesh = createFaceMesh(video, { maxFaces:1, refineLandmarks:false }, () => {
        _ready = true;
        state.ready = true;
        onReady && onReady();
      });
      _faceMesh.on('predict', results => { _results = results; });
    } catch(e) {
      // ml5 v1.x API fallback
      _faceMesh = createFaceMesh({ maxFaces:1 });
      _faceMesh.detectStart(video, results => { _results = results; });
      _ready = true;
      state.ready = true;
      onReady && onReady();
    }
  }

  // ── 매 프레임 업데이트 ──────────────────────────────
  function update(sk) {
    if (!_ready || !_results || _results.length === 0) {
      state.mouthOpen   = false;
      state.faceBox     = null;
      return;
    }

    _sk      = sk;
    _canvasW = sk.width;
    _canvasH = sk.height;
    _videoW  = _video ? (_video.videoWidth  || _video.width  || 640) : 640;
    _videoH  = _video ? (_video.videoHeight || _video.height || 480) : 480;

    const face = _results[0];

    // ml5 버전별 랜드마크 접근
    let landmarks = face.keypoints || face.scaledMesh || face.landmarks || [];
    if (!landmarks.length) return;

    // ── 좌표 변환 함수 (미러 반전 포함) ────────────────
    function mapLM(lm) {
      // 정규화 좌표(0~1) vs 픽셀 좌표 자동 감지
      let nx, ny;
      if (lm.x !== undefined) {
        nx = lm.x > 1 ? lm.x / _videoW : lm.x;
        ny = lm.y > 1 ? lm.y / _videoH : lm.y;
      } else {
        nx = lm[0] / _videoW;
        ny = lm[1] / _videoH;
      }
      return {
        x: _canvasW - nx * _canvasW, // 미러 반전
        y: ny * _canvasH,
      };
    }

    // ── 입 벌림 감지 ─────────────────────────────────
    // 상순(13) 하순(14) — ml5 FaceMesh 468 랜드마크 기준
    const idxUpper = 13;
    const idxLower = 14;

    if (landmarks.length > 14) {
      const upper = mapLM(landmarks[idxUpper]);
      const lower = mapLM(landmarks[idxLower]);

      const rawDist = Math.hypot(
        (landmarks[idxUpper].x > 1 ? landmarks[idxUpper].x/_videoW : landmarks[idxUpper].x) -
        (landmarks[idxLower].x > 1 ? landmarks[idxLower].x/_videoW : landmarks[idxLower].x),
        (landmarks[idxUpper].y > 1 ? landmarks[idxUpper].y/_videoH : landmarks[idxUpper].y) -
        (landmarks[idxLower].y > 1 ? landmarks[idxLower].y/_videoH : landmarks[idxLower].y)
      );

      state.mouthOpen = rawDist > MOUTH_OPEN_THRESHOLD;
      state.mouthCenter = {
        x: (upper.x + lower.x) / 2,
        y: (upper.y + lower.y) / 2,
      };
    }

    // ── 얼굴 Bounding Box ────────────────────────────
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const sample = landmarks.slice(0, 50);
    sample.forEach(lm => {
      const p = mapLM(lm);
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });
    state.faceBox = { x:minX, y:minY, w:maxX-minX, h:maxY-minY };
  }

  // ── 디버그 그리기 ────────────────────────────────────
  function drawDebug(sk) {
    if (!state.debug) return;

    // 입 중심
    sk.push();
    sk.noFill();
    sk.stroke(0, 255, 0, 180);
    sk.strokeWeight(2);
    sk.ellipse(state.mouthCenter.x, state.mouthCenter.y, state.mouthRadius*2, state.mouthRadius*2);

    // 입 열림 표시
    if (state.mouthOpen) {
      sk.fill(0, 255, 0, 100);
      sk.ellipse(state.mouthCenter.x, state.mouthCenter.y, state.mouthRadius*2, state.mouthRadius*2);
    }

    // bounding box
    if (state.faceBox) {
      sk.noFill();
      sk.stroke(255, 255, 0, 150);
      sk.rect(state.faceBox.x, state.faceBox.y, state.faceBox.w, state.faceBox.h);
    }
    sk.pop();
  }

  // ── 입 안에 있는지 확인 ──────────────────────────────
  function isMouthCatch(proj) {
    if (!state.mouthOpen) return false;
    const dx = proj.x - state.mouthCenter.x;
    const dy = proj.y - state.mouthCenter.y;
    return Math.sqrt(dx*dx + dy*dy) < proj.radius + state.mouthRadius;
  }

  // ── 얼굴 피격 확인 ───────────────────────────────────
  function isFaceHit(proj) {
    if (!state.faceBox) return false;
    const fb = state.faceBox;
    return proj.x > fb.x - 20 && proj.x < fb.x + fb.w + 20 &&
           proj.y > fb.y - 20 && proj.y < fb.y + fb.h + 20;
  }

  // ── 얼굴이 가이드 박스 안에 있는지 ──────────────────
  function isFaceInBox(boxX, boxY, boxW, boxH) {
    if (!state.faceBox) return false;
    const cx = state.faceBox.x + state.faceBox.w / 2;
    const cy = state.faceBox.y + state.faceBox.h / 2;
    return cx > boxX && cx < boxX+boxW && cy > boxY && cy < boxY+boxH;
  }

  function getRawFaceMesh() { return _faceMesh; }
  function getVideo()       { return _video; }
  function isReady()        { return _ready; }

  return { init, update, drawDebug, isMouthCatch, isFaceHit, isFaceInBox,
           getRawFaceMesh, getVideo, isReady, state };
})();
