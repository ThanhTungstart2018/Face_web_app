// ==========================================
// FACE HELPER – PRO (2025 Standard)
// ==========================================

let video = null;
let modelsLoaded = false;
let detectionLoopRunning = false;
let currentVideoStream = null;


// Tắt camera và xóa sạch các đối tượng cũ
window.stopFaceCamera_logic = function () {
   detectionLoopRunning = false; // Ngắt vòng lặp requestAnimationFrame
    if (currentVideoStream) {
        // Dừng tất cả các luồng phần cứng (Tắt đèn LED camera)
        currentVideoStream.getTracks().forEach(track => track.stop());
        currentVideoStream = null;
    }
    const video = document.getElementById('face-video');
    if (video) {
        video.srcObject = null;
        video.pause();
    }
    const oldCanvas = document.getElementById('face-canvas');
    if (oldCanvas) oldCanvas.remove(); // Xóa canvas để tránh lỗi logic hiển thị
    console.log("📷 [JS] Camera đã giải phóng hoàn toàn.");
};

window.startFaceDetectLoop_logic = async function () {
    // 1. Reset phiên cũ nếu còn sót
    if (detectionLoopRunning) window.stopFaceCamera_logic();
    
    detectionLoopRunning = true;

    try {
        const video = document.getElementById('face-video');
        if (!video) return;

        // 2. Mở Camera mới
        currentVideoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 640, height: 480 }
        });
        video.srcObject = currentVideoStream;

        // Đợi video sẵn sàng
        await new Promise((resolve) => video.onloadedmetadata = resolve);
        video.play();

        // 3. Tạo Canvas mới khớp với Video hiện tại
        let canvas = faceapi.createCanvasFromMedia(video);
        canvas.id = 'face-canvas';
        canvas.style.position = 'absolute';
        canvas.style.left = '0px';
        canvas.style.top = '0px';
        canvas.style.pointerEvents = 'none';
        video.parentElement.style.position = 'relative';
        video.parentElement.appendChild(canvas);

        const loop = async () => {
            if (!detectionLoopRunning || !video || video.paused || video.readyState < 2) {
                if (detectionLoopRunning) requestAnimationFrame(loop);
                return;
            }

            const displaySize = { width: video.clientWidth, height: video.clientHeight };
            faceapi.matchDimensions(canvas, displaySize);

            const detection = await faceapi
                .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (detection) {
                const resized = faceapi.resizeResults(detection, displaySize);
                const landmarks = resized.landmarks;
                const box = resized.detection.box;

                // Thuật toán Mask/Hat (Tối ưu 2025)
                const isMasked = Math.abs(landmarks.getMouth().y - landmarks.getNose().y) < (box.height * 0.08);
                const isHatOn = (landmarks.getLeftEyeBrow().y + landmarks.getRightEyeBrow().y) / 2 - box.y < (box.height * 0.12);

                const facePosition = {
                    x: (box.x + box.width / 2) / displaySize.width,
                    y: (box.y + box.height / 2) / displaySize.height,
                    width: box.width / displaySize.width,
                    isMasked: isMasked,
                    isHatOn: isHatOn
                };

                // Vẽ khung phản hồi
                ctx.strokeStyle = (isMasked || isHatOn) ? "#FF3B30" : "#00FF00";
                ctx.lineWidth = 3;
                ctx.strokeRect(box.x, box.y, box.width, box.height);

                if (window.onFaceDetected) {
                    window.onFaceDetected(true, Array.from(detection.descriptor), facePosition);
                }
            } else {
                if (window.onFaceDetected) window.onFaceDetected(false, null, null);
            }
            if (detectionLoopRunning) requestAnimationFrame(loop);
        };
        loop();
    } catch (error) {
        console.error("❌ Lỗi Logic hiển thị:", error);
        detectionLoopRunning = false;
    }
};

// =======================
// LOAD MODELS (1 LẦN)
// =======================
async function loadFaceModels() {
    if (modelsLoaded) return;
    
    // >>> SỬA ĐƯỜNG DẪN NÀY NẾU CẦN <<<
    // Ví dụ: 'js/models' hoặc '/assets/models'
const MODEL_URL = 'js/models'; // Hoặc 'models' tùy cấu trúc thư mục của bạn

    console.log('📂 [Helper] Đang tải models từ: ' + MODEL_URL);
    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        modelsLoaded = true;
        console.log('✅ [Helper] Models đã tải xong.');
    } catch (e) {
        console.error('❌ [Helper] Lỗi tải Model:', e);
        throw new Error('Không thể tải Models. Kiểm tra đường dẫn ' + MODEL_URL + ' và quyền CORS.');
    }
}

// =======================
// INIT CAMERA
// =======================
async function initCamera() {
    if (video && video.srcObject) return;

    video = document.getElementById('face-video');
    if (!video) {
        throw new Error('❌ [Helper] Video element not found (#face-video)');
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false
        });

        video.srcObject = stream;
        
        // Chờ video sẵn sàng để play
        return new Promise(resolve => {
            video.onloadedmetadata = () => {
                video.play();
                console.log('📷 [Helper] Camera đã bật.');
                resolve();
            };
        });
    } catch (err) {
        console.error('❌ [Helper] Lỗi truy cập Camera:', err);
        throw err;
    }
}

// =======================
// STOP CAMERA
// =======================
window.stopFaceCamera = function () {
    detectionLoopRunning = false; // QUAN TRỌNG: Phải dừng vòng lặp loop trước
    
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        console.log('🛑 [Helper] Camera đã dừng và reset loop.');
    }
    
    // Xóa khung vẽ trên canvas
    const canvas = document.getElementById('face-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
};

// =======================
// REALTIME FACE DETECT LOOP
// (Gắn vào window để Dart gọi)
// =======================
window.startFaceDetectLoop = async function () {
    if (detectionLoopRunning) return;
    detectionLoopRunning = true;

    try {
        await loadFaceModels();
         //  await initCamera();
        currentVideoStream = await initCamera();
    
        const video = document.getElementById('face-video');
        if (!video) throw new Error("Không tìm thấy thẻ video");

        // Đảm bảo video đã sẵn sàng dữ liệu
        if (video.readyState < 2) {
            await new Promise((resolve) => video.onloadeddata = resolve);
        }

        // 1. Khởi tạo Canvas (Khớp tọa độ gốc)
        let canvas = document.getElementById('face-canvas');
        if (!canvas) {
            canvas = faceapi.createCanvasFromMedia(video);
            canvas.id = 'face-canvas';
            canvas.style.position = 'absolute';
            canvas.style.left = '0px';
            canvas.style.top = '0px';
            canvas.style.pointerEvents = 'none';
            canvas.style.zIndex = '10'; // Đảm bảo nằm trên video
            
            // Thẻ Div bao ngoài video phải là 'relative'
            video.parentElement.style.position = 'relative'; 
            video.parentElement.appendChild(canvas);
        }

        const loop = async () => {
            if (!video || video.paused || video.ended || !detectionLoopRunning) return;

            // 2. Tính liên tục: Cập nhật kích thước hiển thị thực tế trong mỗi Frame
            const displaySize = { 
                width: video.clientWidth, 
                height: video.clientHeight 
            };

            // Đồng bộ kích thước Canvas với kích thước Video hiển thị
            if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
                faceapi.matchDimensions(canvas, displaySize);
            }

            // 3. Phân tích trên độ phân giải gốc
            const detection = await faceapi
                .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (detection) {
                    const resizedDetections = faceapi.resizeResults(detection, displaySize);
                    const landmarks = resizedDetections.landmarks;
                    const box = resizedDetections.detection.box;

                    // ==========================================
                        // ==========================================
                    // 1. TỐI ƯU PHÁT HIỆN KHẨU TRANG (MASK)
                    // ==========================================
                    const mouth = landmarks.getMouth();
                    const nose = landmarks.getNose();
                    const mouthCenterY = mouth.reduce((acc, p) => acc + p.y, 0) / mouth.length;
                    const noseBottomY = nose[6].y; 
                    const mouthNoseDist = mouthCenterY - noseBottomY;

                    let isMasked = false;
                    if (mouthNoseDist < (box.height * 0.1) || detection.detection.score < 0.65) {
                        isMasked = true;
                    }

                    // ==========================================
                    // 2. TỐI ƯU PHÁT HIỆN NÓN (HAT)
                    // ==========================================
                    const leftBrow = landmarks.getLeftEyeBrow();
                    const rightBrow = landmarks.getRightEyeBrow();
                    
                    // Lấy điểm trung bình chiều cao của lông mày
                    const avgBrowY = (leftBrow[0].y + rightBrow[0].y) / 2;
                    
                    // Vùng trán (Forehead) từ đỉnh Box đến lông mày
                    const foreheadHeight = avgBrowY - box.y;
                    
                    let isHatOn = false;
                    // Nếu vùng trán quá ngắn (Nón che khuất lông mày) hoặc Box sát mép camera
                    // Chuẩn 2025: foreheadHeight < 15% tổng chiều cao khuôn mặt là nghi ngờ đeo nón
                    if (foreheadHeight < (box.height * 0.15) || box.y < 10) {
                        isHatOn = true;
                    }

                    const facePosition = {
                        x: (box.x + box.width / 2) / displaySize.width,
                        y: (box.y + box.height / 2) / displaySize.height,
                        width: box.width / displaySize.width,
                        isMasked: isMasked,
                        isHatOn: isHatOn
                    };

                    // --- VẼ DEBUG CHUYÊN NGHIỆP ---
                    const isBlocked = isMasked || isHatOn;
                    const color = isBlocked ? '#FF3B30' : '#daf915ff'; // Red vs Green (iOS 2025 style)
                    
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 3;
                    ctx.strokeRect(box.x, box.y, box.width, box.height);

                  // Vẽ nhãn cảnh báo
                    if (isBlocked) {
                        ctx.fillStyle = color;
                        ctx.font = 'bold 12px Arial';
                        let msg = "";
                        if (isMasked) msg += "❌ THÁO KHẨU TRANG ";
                        if (isHatOn) msg += "❌ BỎ NÓN";
                        
                        // Vẽ nền cho chữ để dễ đọc
                        const textWidth = ctx.measureText(msg).width;
                        ctx.fillRect(box.x, box.y - 35, textWidth + 10, 25);
                        ctx.fillStyle = "#white";
                        ctx.fillText(msg, box.x + 5, box.y - 17);
                    }

                if (window.onFaceDetected) {
                 //   window.onFaceDetected(true, Array.from(detection.descriptor));
                                window.onFaceDetected(true, Array.from(detection.descriptor), facePosition);

                }
            } else {
               // if (window.onFaceDetected) window.onFaceDetected(false, null);
                if (window.onFaceDetected) window.onFaceDetected(false, null, null);
            }

            // Đệ quy bằng requestAnimationFrame để đạt 60fps mượt mà
            if (detectionLoopRunning) {
                requestAnimationFrame(loop);
            }
        };
        loop();

    } catch (error) {
        console.error("❌ Lỗi Logic hiển thị:", error);
        detectionLoopRunning = false;
    }
};

/*
window.startFaceDetectLoop = async function () {
    if (detectionLoopRunning) return;
    detectionLoopRunning = true;
    console.log('🚀 [Helper] Đang khởi tạo vòng lặp nhận diện...');

    try {
        await loadFaceModels();
        await initCamera();

        if (window.onCameraStateChanged) {
            window.onCameraStateChanged(true);
        }

        const loop = async () => {
            if (!video || video.paused || video.ended || !detectionLoopRunning) return;

            const detection = await faceapi
                .detectSingleFace(video)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (window.onFaceDetected) {
                if (detection) {
                    // QUAN TRỌNG: Dùng Array.from để chuyển đổi Float32Array sang mảng Dart hiểu được
                    const descriptorArray = Array.from(detection.descriptor);
                    // Gửi 2 tham số rời rạc: (bool detected, List<double> descriptor)
                 //   console.log('👤 [Helper] Khuôn mặt được phát hiện.' + descriptorArray);
                    window.onFaceDetected(true, descriptorArray);
                } else {
                    window.onFaceDetected(false, null);
                }
            }

            // Quét 10 lần mỗi giây
            setTimeout(loop, 100); 
        };

        loop();

    } catch (error) {
        console.error('❌ [Helper] Lỗi trong startFaceDetectLoop:', error);
        if (window.onCameraStateChanged) {
            window.onCameraStateChanged(false);
        }
        detectionLoopRunning = false;
    }
};
*/
// =======================
// CÁC HÀM KHÁC (Đăng ký, So sánh...)
// =======================

window.getRegisterFaceDescriptor = async function () {
    await loadFaceModels();
    await initCamera();

    let descriptors = [];
    for (let i = 0; i < 5; i++) {
        const detection = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();
        if (detection) descriptors.push(detection.descriptor);
        await new Promise(r => setTimeout(r, 300));
    }
    if (descriptors.length < 3) return null;

    const avg = new Float32Array(128);
    descriptors.forEach(desc => desc.forEach((v, i) => avg[i] += v));
    for (let i = 0; i < 128; i++) avg[i] /= descriptors.length;

    console.log('✅ [Helper] Face registered');
    return Array.from(avg);
};

window.compareFaceDescriptor = function (a, b) {
    let sum = 0;
    for (let i = 0; i < 128; i++) sum += Math.pow(a[i] - b[i], 2);
    return Math.sqrt(sum);
};
