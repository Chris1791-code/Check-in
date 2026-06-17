/* ==========================================================================
   CORE APPLICATION LOGIC FOR QR CHECK-IN SYSTEM
   Author: Antigravity Team
   Stack: Vanilla ES6 JS, SheetJS, html5-qrcode, qrcode.js, Web Audio Synth, LocalStorage
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------------------------------------------------
    // I. STATE & STORAGE MANAGEMENT
    // ----------------------------------------------------------------------

    // --- FIREBASE CONFIGURATION ---
    const firebaseConfig = {
      apiKey: "AIzaSyCHodkEEPu0nbk1WmesegZeGF0nFSDDi2w",
      authDomain: "qr-check-in-18a7b.firebaseapp.com",
      databaseURL: "https://qr-check-in-18a7b-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "qr-check-in-18a7b",
      storageBucket: "qr-check-in-18a7b.firebasestorage.app",
      messagingSenderId: "334150562299",
      appId: "1:334150562299:web:b604012bc4c05fa62f9b5e",
      measurementId: "G-8N0PL61J54"
    };
    
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
    }
    const db = typeof firebase !== 'undefined' ? firebase.database() : null;
    let isInitialFirebaseLoad = true;
    
    let state = {
        users: [],
        customers: [],
        logs: [],
        emails: [],
        activityFeed: [],
        settings: {
            soundEnabled: true,
            soundVolume: 80,
            browserNotifications: false,
            locations: [],
            emailjs: {
                enabled: false,
                serviceId: "",
                templateId: "",
                publicKey: ""
            }
        },
        currentUser: null,
        currentView: "dashboard",
        activeScanner: null,
        currentTheme: "dark"
    };

    let isServerSyncEnabled = false;

    // --- SHARED UTILITIES FOR DE-DUPLICATION ---
    const isValidMatchValue = (val) => {
        if (!val) return false;
        const clean = String(val).trim().toLowerCase();
        return clean !== "" && clean !== "không" && clean !== "none" && clean !== "n/a" && clean !== "no" && clean !== "null" && clean !== "undefined";
    };

    const normalizePhone = (phone) => {
        if (!phone) return "";
        let cleaned = String(phone).replace(/\D/g, "");
        if (cleaned.length === 9 && !cleaned.startsWith("0")) {
            cleaned = "0" + cleaned;
        }
        return cleaned;
    };

    const isPlaceholder = (val) => {
        if (!val) return true;
        const clean = String(val).trim().toLowerCase();
        return clean === "" || clean === "không" || clean === "chưa có" || clean === "none" || clean === "n/a" || clean === "no" || clean === "null" || clean === "undefined";
    };

    const mergeStrings = (val1, val2) => {
        if (isPlaceholder(val1) && !isPlaceholder(val2)) return val2;
        if (!isPlaceholder(val1) && isPlaceholder(val2)) return val1;
        if (isPlaceholder(val1) && isPlaceholder(val2)) return val1 || val2 || "";
        const s1 = String(val1).trim();
        const s2 = String(val2).trim();
        if (s1.toLowerCase().includes(s2.toLowerCase())) return s1;
        if (s2.toLowerCase().includes(s1.toLowerCase())) return s2;
        return s1.length >= s2.length ? s1 : s2;
    };

    const getDeterministicHash = (name, phone, email) => {
        const cleanName = String(name || "").trim().toLowerCase();
        const cleanPhone = normalizePhone(phone);
        const cleanEmail = String(email || "").trim().toLowerCase();
        const uniqueString = `${cleanName}|${cleanPhone}|${cleanEmail}`;
        
        let hash = 0;
        for (let i = 0; i < uniqueString.length; i++) {
            hash = (hash * 31 + uniqueString.charCodeAt(i)) & 0xFFFFFFFF;
        }
        return Math.abs(hash);
    };

    const generateDeterministicId = (name, phone, email, isWalkin = false) => {
        const hashVal = getDeterministicHash(name, phone, email);
        const idNum = (hashVal % 900000000) + 100000000; // 9-digit number
        return isWalkin ? `TIC-W${idNum}` : `TIC-${idNum}`;
    };

    // Load initial state from LocalStorage or mock data
    function initStorage() {
        // Theme init
        const savedTheme = localStorage.getItem("qr_theme") || "dark";
        state.currentTheme = savedTheme;
        document.documentElement.setAttribute("data-theme", savedTheme);
        updateThemeToggleButtonIcon();

        // Users init
        if (!localStorage.getItem("qr_users")) {
            localStorage.setItem("qr_users", JSON.stringify(INITIAL_USERS));
        }
        state.users = JSON.parse(localStorage.getItem("qr_users"));

        // Customers init
        if (!localStorage.getItem("qr_customers")) {
            localStorage.setItem("qr_customers", JSON.stringify(INITIAL_CUSTOMERS));
        }
        state.customers = JSON.parse(localStorage.getItem("qr_customers"));

        // Checkin logs init
        if (!localStorage.getItem("qr_checkin_logs")) {
            localStorage.setItem("qr_checkin_logs", JSON.stringify([]));
        }
        state.logs = JSON.parse(localStorage.getItem("qr_checkin_logs"));

        // Simulated emails init
        if (!localStorage.getItem("qr_emails")) {
            localStorage.setItem("qr_emails", JSON.stringify([]));
        }
        state.emails = JSON.parse(localStorage.getItem("qr_emails"));

        // Activity feeds init
        if (!localStorage.getItem("qr_activity_feed")) {
            localStorage.setItem("qr_activity_feed", JSON.stringify([
                {
                    id: "act-init",
                    type: "info",
                    title: "Hệ thống khởi động",
                    content: "Ứng dụng QR Check-In đã được thiết lập thành công trên LocalStorage.",
                    time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                    timestamp: new Date().toISOString()
                }
            ]));
        }
        state.activityFeed = JSON.parse(localStorage.getItem("qr_activity_feed"));

        // Settings init
        if (!localStorage.getItem("qr_settings")) {
            const defaultSettings = {
                soundEnabled: true,
                soundVolume: 80,
                browserNotifications: false,
                locations: INITIAL_LOCATIONS,
                emailjs: {
                    enabled: false,
                    serviceId: "",
                    templateId: "",
                    publicKey: ""
                },
                sheets: {
                    enabled: false,
                    scriptUrl: ""
                }
            };
            localStorage.setItem("qr_settings", JSON.stringify(defaultSettings));
        }
        state.settings = JSON.parse(localStorage.getItem("qr_settings"));
        if (!state.settings.sheets) {
            state.settings.sheets = { enabled: false, scriptUrl: "" };
        }

        // Prepopulate scanner locations
        populateLocationDropdowns();

        // Run auto de-duplication of existing database records
        deduplicateDatabase();
    }

    function deduplicateDatabase() {
        if (!state.customers || state.customers.length === 0) return;

        let mergedCount = 0;
        const keepers = [];

        state.customers.forEach(cust => {
            const normEmail = cust.Email ? cust.Email.trim().toLowerCase() : "";
            const normPhone = normalizePhone(cust.SoDienThoai);

            const duplicate = keepers.find(k => {
                const kEmail = k.Email ? k.Email.trim().toLowerCase() : "";
                const kPhone = normalizePhone(k.SoDienThoai);
                return (isValidMatchValue(normEmail) && isValidMatchValue(kEmail) && normEmail === kEmail) ||
                       (isValidMatchValue(normPhone) && isValidMatchValue(kPhone) && normPhone === kPhone);
            });

            if (duplicate) {
                // Merge cust into duplicate (keeper)
                // 1. Check-in status
                if (cust.status === "Checked In") {
                    if (duplicate.status !== "Checked In") {
                        duplicate.status = "Checked In";
                        duplicate.checkInTime = cust.checkInTime;
                        duplicate.checkInLocation = cust.checkInLocation;
                        duplicate.checkedBy = cust.checkedBy;
                    } else {
                        // Keep earlier checkin
                        if (cust.checkInTime && duplicate.checkInTime) {
                            if (new Date(cust.checkInTime) < new Date(duplicate.checkInTime)) {
                                duplicate.checkInTime = cust.checkInTime;
                                duplicate.checkInLocation = cust.checkInLocation;
                                duplicate.checkedBy = cust.checkedBy;
                            }
                        }
                    }
                }

                // 2. School
                if (isPlaceholder(duplicate.TruongTHPT) && !isPlaceholder(cust.TruongTHPT)) {
                    duplicate.TruongTHPT = cust.TruongTHPT;
                }

                // 3. Certificates
                duplicate.ChungChiTiengAnh = mergeStrings(duplicate.ChungChiTiengAnh, cust.ChungChiTiengAnh);
                duplicate.ChungChiTuyenSinhQuocTe = mergeStrings(duplicate.ChungChiTuyenSinhQuocTe, cust.ChungChiTuyenSinhQuocTe);

                // 4. Activities
                const parseActivities = (actStr) => {
                    if (isPlaceholder(actStr)) return [];
                    return String(actStr).split(";").map(a => a.trim()).filter(a => !isPlaceholder(a));
                };
                const acts1 = parseActivities(duplicate.TraiNghiemHoatDong);
                const acts2 = parseActivities(cust.TraiNghiemHoatDong);
                const combinedActs = [...acts1];
                acts2.forEach(a2 => {
                    if (!combinedActs.some(a1 => a1.toLowerCase() === a2.toLowerCase())) {
                        combinedActs.push(a2);
                    }
                });
                duplicate.TraiNghiemHoatDong = combinedActs.length > 0 ? combinedActs.join("; ") : "Chưa có";

                // Prefer legacy/shorter ID over deterministic 9-digit ID during merging
                const isLegacyId = (id) => {
                    const numPart = String(id || "").replace("TIC-", "").replace("TIC-W", "");
                    return numPart.length < 9;
                };

                if (isLegacyId(cust.id) && !isLegacyId(duplicate.id)) {
                    const oldKeeperId = duplicate.id;
                    duplicate.id = cust.id;
                    duplicate.qrCode = cust.qrCode;

                    // Update logs referencing either the old keeper ID or duplicate customer ID
                    state.logs.forEach(log => {
                        if (log.customerId === oldKeeperId || log.customerId === cust.id) {
                            log.customerId = duplicate.id;
                            log.customerName = duplicate.HoVaTen;
                        }
                    });

                    // Update emails referencing either the old keeper ID or duplicate customer ID
                    state.emails.forEach(email => {
                        if (email.customerId === oldKeeperId || email.customerId === cust.id) {
                            email.customerId = duplicate.id;
                            email.customerName = duplicate.HoVaTen;
                            email.customerEmail = duplicate.Email;
                        }
                    });
                } else {
                    // Update logs referencing duplicate customer ID
                    state.logs.forEach(log => {
                        if (log.customerId === cust.id) {
                            log.customerId = duplicate.id;
                            log.customerName = duplicate.HoVaTen;
                        }
                    });

                    // Update emails referencing duplicate customer ID
                    state.emails.forEach(email => {
                        if (email.customerId === cust.id) {
                            email.customerId = duplicate.id;
                            email.customerName = duplicate.HoVaTen;
                            email.customerEmail = duplicate.Email;
                        }
                    });
                }

                mergedCount++;
            } else {
                keepers.push(cust);
            }
        });

        if (mergedCount > 0) {
            state.customers = keepers;
            saveState("customers");
            saveState("logs");
            saveState("emails");
            console.log(`Database auto-deduplication: merged ${mergedCount} duplicate customer records.`);
        }
    }

    async function saveState(key) {
        let storageKey = "";
        let val = null;
        if (key === "customers") { storageKey = "qr_customers"; val = state.customers; }
        if (key === "logs") { storageKey = "qr_checkin_logs"; val = state.logs; }
        if (key === "users") { storageKey = "qr_users"; val = state.users; }
        if (key === "emails") { storageKey = "qr_emails"; val = state.emails; }
        if (key === "activityFeed") { storageKey = "qr_activity_feed"; val = state.activityFeed; }
        if (key === "settings") { storageKey = "qr_settings"; val = state.settings; }

        if (storageKey) {
            localStorage.setItem(storageKey, JSON.stringify(val));
            if (db) {
                db.ref('event_data/' + key).set(val).catch(e => console.error("Firebase sync error", e));
            }
        }

        if (isServerSyncEnabled) {
            try {
                await fetch("/api/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ key: key, value: val })
                });
            } catch (err) {
                console.error("Failed to sync state to server for key:", key, err);
            }
        }
    }

    async function stopCameraScan() {
        if (html5QrcodeScanner && isScanning) {
            try {
                await html5QrcodeScanner.stop();
                html5QrcodeScanner.clear();
                isScanning = false;
                // Add delay for iOS hardware release
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (err) {
                console.warn("Could not stop camera cleanly", err);
            }
        }
    }

    // ----------------------------------------------------------------------
    // II. AUDIO SYNTHESIZER (WEB AUDIO API - NO EXTERNAL MP3 NEEDED)
    // ----------------------------------------------------------------------
    function playNotificationSound(type) {
        if (!state.settings.soundEnabled) return;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            
            const ctx = new AudioContext();
            const gainNode = ctx.createGain();
            gainNode.gain.setValueAtTime((state.settings.soundVolume / 100) * 0.15, ctx.currentTime);
            gainNode.connect(ctx.destination);

            if (type === "success") {
                // High-tech success chime: Two sine waves, slide pitch upwards
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                
                osc1.type = "sine";
                osc2.type = "sine";

                osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
                osc1.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.15); // C6
                
                osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.05); // E5
                osc2.frequency.exponentialRampToValueAtTime(1318.51, ctx.currentTime + 0.20); // E6

                osc1.connect(gainNode);
                osc2.connect(gainNode);

                osc1.start();
                osc2.start();

                gainNode.gain.setValueAtTime((state.settings.soundVolume / 100) * 0.15, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

                osc1.stop(ctx.currentTime + 0.35);
                osc2.stop(ctx.currentTime + 0.35);

            } else if (type === "error") {
                // Harsh buzz for error
                const osc = ctx.createOscillator();
                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(150, ctx.currentTime);
                osc.frequency.setValueAtTime(120, ctx.currentTime + 0.1);
                
                osc.connect(gainNode);
                osc.start();
                
                gainNode.gain.setValueAtTime((state.settings.soundVolume / 100) * 0.2, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
                
                osc.stop(ctx.currentTime + 0.25);
            } else if (type === "broadcast") {
                // Bell chime for broadcast announcements
                const osc = ctx.createOscillator();
                osc.type = "triangle";
                osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
                osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5); // A4

                osc.connect(gainNode);
                osc.start();

                gainNode.gain.setValueAtTime((state.settings.soundVolume / 100) * 0.25, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

                osc.stop(ctx.currentTime + 0.6);
            }
        } catch (e) {
            console.error("Audio Context playback failed:", e);
        }
    }

    // ----------------------------------------------------------------------
    // III. SPA ROUTING & NAVIGATION
    // ----------------------------------------------------------------------
    const views = document.querySelectorAll(".view-section");
    const navItems = document.querySelectorAll(".nav-item");
    const viewTitleEl = document.getElementById("view-title");

    function switchView(viewId) {
        // Stop camera if leaving scanner
        if (state.currentView === "scanner" && viewId !== "scanner") {
            stopScanning();
        }

        state.currentView = viewId;
        views.forEach(view => {
            view.classList.remove("active");
            if (view.id === `view-${viewId}`) {
                view.classList.add("active");
            }
        });

        navItems.forEach(item => {
            item.classList.remove("active");
            if (item.getAttribute("data-view") === viewId) {
                item.classList.add("active");
            }
        });

        // Set View Title
        const activeNavEl = document.querySelector(`.nav-item[data-view="${viewId}"]`);
        if (activeNavEl) {
            viewTitleEl.textContent = activeNavEl.querySelector("span").textContent;
        }

        // Trigger view-specific render updates
        if (viewId === "dashboard") {
            renderDashboard();
        } else if (viewId === "customers") {
            renderCustomersTable();
        } else if (viewId === "history") {
            renderHistoryTable();
            populateHistoryFilters();
        } else if (viewId === "users") {
            renderUsersTable();
        } else if (viewId === "emails") {
            renderEmailOutbox();
        } else if (viewId === "settings") {
            renderSettings();
        } else if (viewId === "scanner") {
            loadCameras();
        }

        // Close sidebar on mobile after navigating
        document.querySelector(".sidebar").classList.remove("active");
    }

    // Attach navigation click events
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetView = item.getAttribute("data-view");
            switchView(targetView);
        });
    });

    // Mobile sidebar toggle
    document.getElementById("btn-toggle-sidebar").addEventListener("click", () => {
        document.querySelector(".sidebar").classList.add("active");
    });

    // Close sidebar clicking outside on mobile
    document.addEventListener("click", (e) => {
        const sidebar = document.querySelector(".sidebar");
        const toggleBtn = document.getElementById("btn-toggle-sidebar");
        if (window.innerWidth <= 768 && 
            sidebar.classList.contains("active") && 
            !sidebar.contains(e.target) && 
            !toggleBtn.contains(e.target)) {
            sidebar.classList.remove("active");
        }
    });

    // ----------------------------------------------------------------------
    // IV. AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC)
    // ----------------------------------------------------------------------
    const screenLogin = document.getElementById("screen-login");
    const screenMain = document.getElementById("screen-main");
    const loginForm = document.getElementById("login-form");
    const userDisplayNameEl = document.getElementById("user-display-name");
    const userDisplayRoleEl = document.getElementById("user-display-role");
    const userAvatarEl = document.getElementById("user-avatar");

    function applyRBAC(role) {
        const adminElements = document.querySelectorAll("[data-admin-only]");
        if (role === "admin") {
            adminElements.forEach(el => el.style.display = "");
        } else if (role === "manager") {
            adminElements.forEach(el => el.style.display = "none");
            // Allow manager to access other tabs
        } else {
            // Role: user (only Dashboard & Scanner allowed)
            adminElements.forEach(el => el.style.display = "none");
            document.getElementById("nav-customers").style.display = "none";
            document.getElementById("nav-history").style.display = "none";
        }
    }

    function checkLoginSession() {
        const sessionUser = sessionStorage.getItem("qr_logged_user");
        if (sessionUser) {
            const user = JSON.parse(sessionUser);
            state.currentUser = user;
            
            // Set details
            userDisplayNameEl.textContent = user.name;
            userAvatarEl.textContent = getInitials(user.name);
            
            // Set Role Badge
            userDisplayRoleEl.className = `user-role-badge badge-${user.role}`;
            userDisplayRoleEl.textContent = user.role === "admin" ? "Quản trị viên" : (user.role === "manager" ? "Quản lý" : "Người dùng");
            
            applyRBAC(user.role);
            
            screenLogin.classList.remove("active");
            screenMain.classList.add("active");
            
            switchView("dashboard");
            startClock();
        } else {
            screenMain.classList.remove("active");
            screenLogin.classList.add("active");
        }
    }

    loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value.trim();
        const pass = document.getElementById("login-password").value;

        const foundUser = state.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === pass);

        if (foundUser) {
            sessionStorage.setItem("qr_logged_user", JSON.stringify(foundUser));
            showToast("Thành công", `Chào mừng quay trở lại, ${foundUser.name}!`, "success");
            checkLoginSession();
        } else {
            showToast("Đăng nhập thất bại", "Email hoặc mật khẩu không hợp lệ.", "error");
            playNotificationSound("error");
        }
    });

    // Preset test accounts handler
    document.querySelectorAll(".badge-account").forEach(btn => {
        btn.addEventListener("click", () => {
            document.getElementById("login-email").value = btn.getAttribute("data-email");
            document.getElementById("login-password").value = btn.getAttribute("data-pass");
        });
    });

    // Toggle show password
    document.getElementById("btn-toggle-password").addEventListener("click", function() {
        const passInput = document.getElementById("login-password");
        const icon = this.querySelector("i");
        if (passInput.type === "password") {
            passInput.type = "text";
            icon.className = "ri-eye-off-line";
        } else {
            passInput.type = "password";
            icon.className = "ri-eye-line";
        }
    });

    // Logout
    document.getElementById("btn-logout").addEventListener("click", () => {
        sessionStorage.removeItem("qr_logged_user");
        state.currentUser = null;
        stopScanning();
        showToast("Đăng xuất", "Bạn đã đăng xuất khỏi hệ thống thành công.", "info");
        checkLoginSession();
    });

    function getInitials(name) {
        const parts = name.split(" ");
        if (parts.length >= 2) {
            return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    // Header Live Clock
    let clockInterval;
    function startClock() {
        if (clockInterval) clearInterval(clockInterval);
        const clockEl = document.getElementById("header-clock-time");
        clockInterval = setInterval(() => {
            const now = new Date();
            clockEl.textContent = now.toLocaleTimeString('vi-VN');
        }, 1000);
    }

    // ----------------------------------------------------------------------
    // V. GENERAL TOAST & PUSH NOTIFICATIONS
    // ----------------------------------------------------------------------
    function showToast(title, desc, type = "info") {
        const container = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        
        let iconClass = "ri-information-line info";
        if (type === "success") iconClass = "ri-checkbox-circle-line success";
        if (type === "error") iconClass = "ri-close-circle-line error";
        if (type === "warning") iconClass = "ri-alert-line warning";

        toast.innerHTML = `
            <i class="toast-icon ${iconClass}"></i>
            <div class="toast-details">
                <h4 class="toast-title">${title}</h4>
                <p class="toast-desc">${desc}</p>
            </div>
            <button class="toast-close"><i class="ri-close-line"></i></button>
        `;

        container.appendChild(toast);

        // Bind close button
        toast.querySelector(".toast-close").addEventListener("click", () => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(50px) scale(0.9)";
            setTimeout(() => toast.remove(), 300);
        });

        // Auto remove
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = "0";
                toast.style.transform = "translateX(50px) scale(0.9)";
                setTimeout(() => toast.remove(), 300);
            }
        }, 4000);

        // Native Browser Push Notification
        if (state.settings.browserNotifications && Notification.permission === "granted") {
            try {
                new Notification(title, {
                    body: desc,
                    icon: "https://cdn-icons-png.flaticon.com/512/3076/3076404.png"
                });
            } catch (err) {
                console.error("Browser notification failed to send:", err);
            }
        }
    }

    // Request Notification permission
    document.getElementById("btn-request-browser-notification").addEventListener("click", () => {
        if (!("Notification" in window)) {
            showToast("Lỗi", "Trình duyệt của bạn không hỗ trợ thông báo đẩy hệ thống.", "error");
            return;
        }

        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                state.settings.browserNotifications = true;
                saveState("settings");
                document.getElementById("settings-browser-notification-enabled").checked = true;
                showToast("Thành công", "Quyền thông báo đẩy trình duyệt đã được cấp!", "success");
                playNotificationSound("success");
            } else {
                state.settings.browserNotifications = false;
                saveState("settings");
                document.getElementById("settings-browser-notification-enabled").checked = false;
                showToast("Bị Từ Chối", "Thông báo trình duyệt đã bị vô hiệu hóa.", "warning");
            }
        });
    });

    // ----------------------------------------------------------------------
    // VI. ACTIVITY LOGGER & BELL
    // ----------------------------------------------------------------------
    const bellBtn = document.getElementById("btn-notification-bell");
    const bellDot = document.getElementById("bell-dot");
    const dropdownFeed = document.getElementById("notification-dropdown");
    const activityFeedList = document.getElementById("activity-feed-list");

    bellBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdownFeed.classList.toggle("active");
        bellDot.classList.add("hide");
    });

    document.addEventListener("click", () => {
        dropdownFeed.classList.remove("active");
    });

    dropdownFeed.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    function logActivity(type, title, content) {
        const activity = {
            id: "act-" + Date.now() + Math.random().toString(36).substr(2, 4),
            type, // success, info, broadcast
            title,
            content,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            timestamp: new Date().toISOString()
        };

        state.activityFeed.unshift(activity);
        
        // Cap list at 25 records
        if (state.activityFeed.length > 25) {
            state.activityFeed.pop();
        }

        saveState("activityFeed");
        renderActivityFeed();

        // Highlight bell dot
        bellDot.classList.remove("hide");
    }

    function renderActivityFeed() {
        if (state.activityFeed.length === 0) {
            activityFeedList.innerHTML = '<div class="feed-empty">Không có hoạt động mới nào.</div>';
            return;
        }

        activityFeedList.innerHTML = state.activityFeed.map(feed => {
            let icon = "ri-information-line";
            if (feed.type === "success") icon = "ri-checkbox-circle-line";
            if (feed.type === "broadcast") icon = "ri-broadcast-line";
            
            return `
                <div class="feed-item">
                    <div class="feed-icon ${feed.type}">
                        <i class="${icon}"></i>
                    </div>
                    <div class="feed-body">
                        <p><strong>${feed.title}</strong>: ${feed.content}</p>
                        <span class="feed-time">${feed.time}</span>
                    </div>
                </div>
            `;
        }).join("");
    }

    document.getElementById("btn-clear-activity-feed").addEventListener("click", () => {
        state.activityFeed = [];
        saveState("activityFeed");
        renderActivityFeed();
        bellDot.classList.add("hide");
        showToast("Xóa nhật ký", "Đã xóa toàn bộ nhật ký hoạt động.", "info");
    });

    // ----------------------------------------------------------------------
    // VII. BROADCAST EVENTS CONTROL
    // ----------------------------------------------------------------------
    const broadcastForm = document.getElementById("broadcast-form");
    
    broadcastForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const title = document.getElementById("broadcast-title").value.trim();
        const content = document.getElementById("broadcast-content").value.trim();

        logActivity("broadcast", `Phát sóng: ${title}`, content);
        playNotificationSound("broadcast");

        // Broadcast to current viewport (since this is SPA client model, we show toast directly)
        showToast(`LOA PHÁT THANH: ${title}`, content, "warning");

        document.getElementById("broadcast-title").value = "";
        document.getElementById("broadcast-content").value = "";
    });

    // ----------------------------------------------------------------------
    // VIII. DASHBOARD RENDERING
    // ----------------------------------------------------------------------
    function renderDashboard() {
        const total = state.customers.length;
        const checkedIn = state.customers.filter(c => c.status === "Checked In").length;
        const pending = total - checkedIn;

        const hasCert = cust => {
            const english = (cust.ChungChiTiengAnh || "").trim().toLowerCase();
            const international = (cust.ChungChiTuyenSinhQuocTe || "").trim().toLowerCase();
            const hasEnglish = english !== "" && english !== "không" && english !== "none" && english !== "no" && english !== "n/a";
            const hasIntl = international !== "" && international !== "không" && international !== "none" && international !== "no" && international !== "n/a";
            return hasEnglish || hasIntl;
        };

        const certChecked = state.customers.filter(c => c.status === "Checked In" && hasCert(c)).length;
        const certTotal = state.customers.filter(hasCert).length;

        // Statistics Text
        document.getElementById("stat-total-customers").textContent = total;
        document.getElementById("stat-checked-in").textContent = checkedIn;
        document.getElementById("stat-pending").textContent = pending;
        document.getElementById("stat-vip-checked").textContent = `${certChecked}/${certTotal}`;

        // Percentage calculations
        const checkPct = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
        const pendPct = total > 0 ? Math.round((pending / total) * 100) : 0;

        document.getElementById("stat-checked-percentage").innerHTML = `<i class="ri-arrow-up-s-line"></i> ${checkPct}% đã quét`;
        document.getElementById("stat-pending-percentage").innerHTML = `<i class="ri-arrow-down-s-line"></i> ${pendPct}% chưa quét`;

        if (certTotal > 0) {
            const certPct = Math.round((certChecked / certTotal) * 100);
            document.getElementById("stat-vip-ratio").innerHTML = `<i class="ri-vip-crown-line"></i> Đã hoàn thành ${certPct}%`;
        } else {
            document.getElementById("stat-vip-ratio").innerHTML = `<i class="ri-vip-crown-line"></i> 0 học sinh có CC`;
        }

        // Radial Progress Arc
        const radialBar = document.getElementById("radial-progress-bar");
        const dashboardPctText = document.getElementById("dashboard-progress-percent");
        dashboardPctText.textContent = `${checkPct}%`;
        
        // Stroke calculation: r=42 -> Circumference = 263.89
        const strokeDashOffset = 263.89 - (263.89 * checkPct) / 100;
        radialBar.style.strokeDashoffset = strokeDashOffset;

        // Linear Progress Bar
        document.getElementById("progress-text-actual").textContent = `${checkedIn}/${total}`;
        document.getElementById("linear-progress-bar").style.width = `${checkPct}%`;

        // Populate Recent Check-Ins Table
        const recentTable = document.getElementById("dashboard-recent-checkins");
        const recentLogs = [...state.logs].slice(-5).reverse(); // Last 5 logs

        if (recentLogs.length === 0) {
            recentTable.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted">Chương trình chưa có ai check-in. Vui lòng chuyển sang tab Quét Mã để thực hiện.</td>
                </tr>
            `;
            return;
        }

        recentTable.innerHTML = recentLogs.map(log => {
            const cust = state.customers.find(c => c.id === log.customerId) || {};
            const cleanTime = new Date(log.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const hasEnglish = cust.ChungChiTiengAnh && cust.ChungChiTiengAnh.toLowerCase() !== 'không' && cust.ChungChiTiengAnh.trim() !== '';
            const englishText = hasEnglish ? cust.ChungChiTiengAnh : 'Không';
            
            return `
                <tr>
                    <td><strong>${log.customerName}</strong><br><span class="text-muted font-12">${log.customerId}</span></td>
                    <td>${cust.TruongTHPT || 'N/A'}</td>
                    <td><span class="badge-type ${hasEnglish ? 'vip' : 'standard'}">${englishText}</span></td>
                    <td>${cleanTime}</td>
                    <td><i class="ri-map-pin-line text-muted"></i> ${log.location}</td>
                    <td>${log.checkedBy}</td>
                </tr>
            `;
        }).join("");
    }

    document.getElementById("btn-quick-nav-scanner").addEventListener("click", () => {
        switchView("scanner");
    });

    // ----------------------------------------------------------------------
    // IX. WEBCAM QR SCANNER INTEGRATION
    // ----------------------------------------------------------------------
    let html5QrcodeScanner = null;
    let ipStreamInterval = null;
    let currentCameraMode = 'single'; // 'single' or 'multi'
    let activeScanners = {
        'slot-1': null,
        'slot-2': null,
        'slot-3': null,
        'slot-4': null
    };
    const cameraSelect = document.getElementById("camera-select");
    const locationSelect = document.getElementById("scanner-location");
    const sessionCountEl = document.getElementById("session-checkin-count");
    const sessionLogsEl = document.getElementById("session-checkin-logs");
    
    let sessionCount = 0;

    function populateLocationDropdowns() {
        const optionHTML = state.settings.locations.map(loc => `<option value="${loc}">${loc}</option>`).join("");
        locationSelect.innerHTML = optionHTML;
        
        // Also populate history filter location
        const histLoc = document.getElementById("history-filter-location");
        if (histLoc) {
            histLoc.innerHTML = `<option value="">Tất cả địa điểm</option>` + state.settings.locations.map(loc => `<option value="${loc}">${loc}</option>`).join("");
        }
    }

    // Modal Camera Help & Tab switching
    const cameraHelpModal = document.getElementById("modal-camera-help");
    const modalTabBtns = document.querySelectorAll(".modal-tab-btn");
    const tabPanes = document.querySelectorAll("#modal-camera-help .tab-pane");

    modalTabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTab = btn.getAttribute("data-tab");
            
            // Remove active state from all tabs
            modalTabBtns.forEach(b => {
                b.classList.remove("active");
                b.style.background = "transparent";
                b.style.color = "var(--text-secondary)";
            });
            
            tabPanes.forEach(pane => {
                pane.classList.remove("active");
                pane.classList.add("hide");
            });

            // Set active to clicked tab
            btn.classList.add("active");
            btn.style.background = "var(--color-primary-alpha)";
            btn.style.color = "var(--color-primary)";
            
            const targetPane = document.getElementById(targetTab);
            if (targetPane) {
                targetPane.classList.add("active");
                targetPane.classList.remove("hide");
            }
        });
    });

    const btnCameraHelpGuide = document.getElementById("btn-camera-help-guide");
    const btnOpenGuideModal = document.getElementById("btn-open-guide-modal");
    const btnCloseCameraHelp = document.getElementById("btn-close-camera-help");
    const btnCloseCameraHelpOk = document.getElementById("btn-close-camera-help-ok");

    function openCameraHelp(defaultTab = "tab-virtual-webcam") {
        if (cameraHelpModal) {
            cameraHelpModal.classList.add("active");
            const btn = document.querySelector(`.modal-tab-btn[data-tab="${defaultTab}"]`);
            if (btn) btn.click();
        }
    }

    if (btnCameraHelpGuide) {
        btnCameraHelpGuide.addEventListener("click", () => openCameraHelp("tab-virtual-webcam"));
    }
    if (btnOpenGuideModal) {
        btnOpenGuideModal.addEventListener("click", () => openCameraHelp("tab-virtual-webcam"));
    }
    if (btnCloseCameraHelp) {
        btnCloseCameraHelp.addEventListener("click", () => {
            cameraHelpModal.classList.remove("active");
        });
    }
    if (btnCloseCameraHelpOk) {
        btnCloseCameraHelpOk.addEventListener("click", () => {
            cameraHelpModal.classList.remove("active");
        });
    }

    // QR Image File Upload Scanner
    const btnUploadQrFile = document.getElementById("btn-upload-qr-file");
    const qrFileInput = document.getElementById("qr-file-input");

    if (btnUploadQrFile && qrFileInput) {
        btnUploadQrFile.addEventListener("click", () => {
            qrFileInput.click();
        });

        qrFileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Reset input so user can scan same file again
            e.target.value = "";

            showToast("Đang phân tích", "Đang xử lý hình ảnh và giải mã...", "info");

            const tempDiv = document.createElement("div");
            tempDiv.id = "temp-qr-scan-" + Date.now();
            tempDiv.style.display = "none";
            document.body.appendChild(tempDiv);

            const fileDecoder = new Html5Qrcode(tempDiv.id, {
                
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: false
                }
            });
            fileDecoder.scanFile(file, true)
                .then(decodedText => {
                    handleCheckIn(decodedText);
                    document.body.removeChild(tempDiv);
                })
                .catch(err => {
                    console.error("Image file scanning failed:", err);
                    playNotificationSound("error");
                    showToast("Quét file thất bại", "Không tìm thấy mã QR hoặc mã vạch hợp lệ trong file ảnh này. Vui lòng chọn ảnh rõ nét hơn.", "error");
                    document.body.removeChild(tempDiv);
                });
        });
    }

    // IP Camera Stream Scanner Panel Toggle
    const btnToggleIpStream = document.getElementById("btn-toggle-ip-stream");
    const ipStreamInputCard = document.getElementById("ip-stream-input-card");
    const btnCloseIpPanel = document.getElementById("btn-close-ip-panel");
    const btnCancelIpStream = document.getElementById("btn-cancel-ip-stream");
    const btnStartIpStream = document.getElementById("btn-start-ip-stream");
    const ipStreamUrlInput = document.getElementById("ip-stream-url");

    if (btnToggleIpStream && ipStreamInputCard) {
        btnToggleIpStream.addEventListener("click", () => {
            ipStreamInputCard.classList.remove("hide");
        });
    }
    if (btnCloseIpPanel && ipStreamInputCard) {
        btnCloseIpPanel.addEventListener("click", () => {
            ipStreamInputCard.classList.add("hide");
        });
    }
    if (btnCancelIpStream && ipStreamInputCard) {
        btnCancelIpStream.addEventListener("click", () => {
            ipStreamInputCard.classList.add("hide");
            stopIpStreamScan();
        });
    }

    function stopIpStreamScan() {
        if (ipStreamInterval) {
            clearInterval(ipStreamInterval);
            ipStreamInterval = null;
            showToast("Ngắt IP Camera", "Đã dừng luồng kết nối IP Camera.", "info");
        }
        if (btnStartIpStream) {
            btnStartIpStream.innerHTML = "Kết nối & Quét";
            btnStartIpStream.removeAttribute("disabled");
        }
        
        // Reset viewport state if standard camera is not running
        if (!html5QrcodeScanner) {
            const cameraPlaceholder = document.getElementById("scanner-placeholder");
            const viewportWrapper = document.getElementById("single-camera-viewport");
            if (viewportWrapper) viewportWrapper.classList.remove("active-scanning");
            if (cameraPlaceholder) cameraPlaceholder.classList.remove("hide");
            
            // Clean dynamic preview image from qr-reader
            const qrReader = document.getElementById("qr-reader");
            if (qrReader) qrReader.innerHTML = "";
        }
    }

    if (btnStartIpStream) {
        btnStartIpStream.addEventListener("click", () => {
            const url = ipStreamUrlInput.value.trim();
            if (!url) {
                showToast("Lỗi liên kết", "Vui lòng nhập địa chỉ URL dòng ảnh Snapshot từ IP Camera.", "error");
                return;
            }

            // Stop normal camera if running
            if (html5QrcodeScanner) {
                stopScanning();
            }

            // Stop existing IP Stream scan if running
            if (ipStreamInterval) {
                clearInterval(ipStreamInterval);
                ipStreamInterval = null;
            }

            showToast("Đang kết nối", "Đang nạp luồng IP Camera không dây...", "info");

            ipStreamInputCard.classList.add("hide");
            
            const cameraPlaceholder = document.getElementById("scanner-placeholder");
            const viewportWrapper = document.getElementById("single-camera-viewport");
            
            if (cameraPlaceholder) cameraPlaceholder.classList.add("hide");
            if (viewportWrapper) viewportWrapper.classList.add("active-scanning");

            btnStartIpStream.innerHTML = "<i class='ri-loader-4-line ri-spin'></i> Đang kết nối...";
            btnStartIpStream.setAttribute("disabled", "true");

            const qrReader = document.getElementById("qr-reader");
            qrReader.innerHTML = "";
            const streamImg = document.createElement("img");
            streamImg.style.width = "100%";
            streamImg.style.height = "100%";
            streamImg.style.objectFit = "cover";
            qrReader.appendChild(streamImg);

            const tempDiv = document.createElement("div");
            tempDiv.id = "temp-ip-scan-" + Date.now();
            tempDiv.style.display = "none";
            document.body.appendChild(tempDiv);
            
            const ipDecoder = new Html5Qrcode(tempDiv.id, {
                
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: false
                }
            });
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            let isProcessingFrame = false;
            let firstFrameSuccess = false;

            ipStreamInterval = setInterval(() => {
                if (isProcessingFrame) return;
                isProcessingFrame = true;

                const currentUrl = ipStreamUrlInput.value.trim();
                if (!currentUrl) {
                    stopIpStreamScan();
                    document.body.removeChild(tempDiv);
                    return;
                }

                // Cache buster
                const delim = currentUrl.includes("?") ? "&" : "?";
                const busterUrl = `${currentUrl}${delim}_t=${Date.now()}`;

                const img = new Image();
                img.crossOrigin = "anonymous";

                img.onload = () => {
                    if (!firstFrameSuccess) {
                        firstFrameSuccess = true;
                        showToast("Đã kết nối", "Bắt đầu kéo luồng video IP Camera và quét mã QR.", "success");
                        btnStartIpStream.innerHTML = "Đang Quét...";
                    }

                    streamImg.src = busterUrl;

                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);

                    try {
                        canvas.toBlob((blob) => {
                            if (!blob) {
                                isProcessingFrame = false;
                                return;
                            }
                            const file = new File([blob], "frame.jpg", { type: "image/jpeg" });
                            
                            ipDecoder.scanFile(file, true)
                                .then(decodedText => {
                                    handleCheckIn(decodedText);
                                    isProcessingFrame = false;
                                })
                                .catch(() => {
                                    isProcessingFrame = false;
                                });
                        }, "image/jpeg", 0.8);
                    } catch (err) {
                        console.error("CORS security error captured:", err);
                        playNotificationSound("error");
                        showToast("Lỗi CORS bảo mật", "Thiết bị IP Camera chặn chia sẻ hình ảnh với trình duyệt. Vui lòng sử dụng Camera ảo (tab 1) hoặc Quét file ảnh.", "error");
                        stopIpStreamScan();
                        document.body.removeChild(tempDiv);
                    }
                };

                img.onerror = () => {
                    isProcessingFrame = false;
                    // If still trying to connect
                    if (!firstFrameSuccess) {
                        showToast("Lỗi kết nối", "Không thể tải ảnh từ URL. Kiểm tra mạng Wi-Fi và địa chỉ IP.", "error");
                        stopIpStreamScan();
                        document.body.removeChild(tempDiv);
                    }
                };

                img.src = busterUrl;
            }, 1000);
        });
    }

    function startScanning() {
        const cameraPlaceholder = document.getElementById("scanner-placeholder");
        const viewportWrapper = document.querySelector(".scanner-viewport-wrapper");
        
        cameraPlaceholder.classList.add("hide");
        viewportWrapper.classList.add("active-scanning");

        const selectedCameraId = cameraSelect.value;
        if (!selectedCameraId) {
            showToast("Lỗi camera", "Vui lòng chọn một thiết bị camera từ danh sách.", "error");
            viewportWrapper.classList.remove("active-scanning");
            cameraPlaceholder.classList.remove("hide");
            return;
        }

        // Stop IP Stream scanner if active
        if (ipStreamInterval) {
            stopIpStreamScan();
        }

        if (html5QrcodeScanner) {
            html5QrcodeScanner.stop().then(() => {
                initCameraScan(selectedCameraId);
            });
        } else {
            initCameraScan(selectedCameraId);
        }
    }

    function initCameraScan(cameraId) {
        html5QrcodeScanner = new Html5Qrcode("qr-reader", {
            
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: false
            }
        });
        
        let scanConfig = {
            fps: 25,
            // qrbox removed for full-frame barcode scanning
        };

        let startConfig = (cameraId === "environment" || cameraId === "user") ? { facingMode: cameraId } : cameraId;
        delete scanConfig.videoConstraints;

        
        // Apply HD resolution
        scanConfig.videoConstraints = { width: { ideal: 1920 }, height: { ideal: 1080 } };
        


        let startPromise = html5QrcodeScanner.start(
            startConfig,
            scanConfig,
            (decodedText) => handleCheckIn(decodedText),
            (errorMessage) => { /* silently ignore */ }
        );

        startPromise.then(() => {
            // Success! Permission is granted, reload cameras to get full labels
            loadCameras();
            // Try to set zoom and focus for small barcodes
            setTimeout(() => {
                try {
                    const videoEl = document.querySelector("#qr-reader video");
                    if (videoEl && videoEl.srcObject) {
                        const track = videoEl.srcObject.getVideoTracks()[0];
                        const caps = track.getCapabilities();
                        const constraints = { advanced: [] };
                        let apply = false;
                        if (caps.focusMode && caps.focusMode.includes('continuous')) {
                            constraints.focusMode = 'continuous';
                            apply = true;
                        }
                        if (caps.zoom) {
                            const zoomVal = Math.min(caps.zoom.max, Math.max(caps.zoom.min, 2.0));
                            constraints.advanced.push({ zoom: zoomVal });
                            apply = true;
                        }
                        if (apply) track.applyConstraints(constraints);
                    }
                } catch(e){}
            }, 1500);
        }).catch(err => {
            console.error("Error starting camera reader:", err);
            
            if (typeof startConfig === 'string') {
                console.warn("Failed with deviceId, trying exact environment fallback", err);
                html5QrcodeScanner.start({ facingMode: "environment" }, scanConfig, 
                    (decodedText) => handleCheckIn(decodedText), 
                    (errorMessage) => { /* silently ignore */ }
                ).then(() => {
                    loadCameras();
                }).catch(errFallback => {
                    alert(`Lỗi Camera iPhone\nKhông thể khởi động camera (${errFallback.name || errFallback.message || errFallback}). Thử tải lại trang hoặc mở bằng trình duyệt Safari.`);
                });
                return;
            }

            let errMsg = `Không thể khởi động camera (${err.name || err.message || err}).`;
            const ua = navigator.userAgent.toLowerCase();
            const isIOS = /ipad|iphone|ipod/.test(ua) && !window.MSStream;
            const isWebView = /fbav|instagram|messenger|zalo|line|snapchat|wechat/.test(ua) || (isIOS && !/safari/.test(ua));
            
            if (isWebView) {
                errMsg += " Bạn đang mở link trong trình duyệt Zalo/Facebook. Vui lòng bấm vào nút menu chia sẻ (3 dấu chấm) và chọn 'Mở bằng Safari' (trên iPhone) hoặc 'Mở bằng Chrome' (trên Android).";
            } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                errMsg += " Bạn cần cấp quyền truy cập Camera cho trang web trong cài đặt.";
            } else {
                errMsg += " Vui lòng thử chuyển sang thiết bị camera khác trong danh sách (Camera 1, 2, 3...).";
            }
            showToast("Lỗi Camera", errMsg, "error");
            stopScanning();
        });
    }
    function stopScanning() {
        const cameraPlaceholder = document.getElementById("scanner-placeholder");
        const viewportWrapper = document.getElementById("single-camera-viewport");
        
        if (viewportWrapper) viewportWrapper.classList.remove("active-scanning");
        if (cameraPlaceholder) cameraPlaceholder.classList.remove("hide");

        // Clean out IP stream scanning too
        stopIpStreamScan();

        if (html5QrcodeScanner) {
            html5QrcodeScanner.stop().then(() => {
                html5QrcodeScanner = null;
            }).catch(err => {
                console.error("Failed to stop scanner gracefully:", err);
                html5QrcodeScanner = null;
            });
        }

        // Also stop all multi-camera slots!
        for (let i = 1; i <= 4; i++) {
            stopSlotScanning(`slot-${i}`);
        }
    }

    // Initialize list of cameras
    function loadCameras() {
        if (typeof Html5Qrcode === "undefined") {
            console.warn("Html5Qrcode library is not loaded. Camera scanning will be unavailable.");
            cameraSelect.innerHTML = `<option value="">Thư viện Camera không khả dụng</option>`;
            document.querySelectorAll(".slot-camera-select").forEach(select => {
                select.innerHTML = `<option value="">Thư viện Camera không khả dụng</option>`;
            });
            return;
        }
        Html5Qrcode.getCameras().then(cameras => {
            let options = [];
            options.push('<option value="environment">📷 Camera Sau (Mặc định)</option>');
            options.push('<option value="user">🤳 Camera Trước (Mặc định)</option>');
            
            if (cameras && cameras.length > 0) {
                cameras.forEach((cam, idx) => {
                    options.push(`<option value="${cam.id}">${cam.label || `Camera ${idx + 1}`}</option>`);
                });
            }
            cameraSelect.innerHTML = options.join("");
            
            // Populate slot camera dropdowns
            const slotSelects = document.querySelectorAll(".slot-camera-select");
            slotSelects.forEach((select, idx) => {
                let slotOptions = ['<option value="">Chọn Cam...</option>'];
                slotOptions.push('<option value="environment">📷 Cam Sau</option>');
                slotOptions.push('<option value="user">🤳 Cam Trước</option>');
                if (cameras && cameras.length > 0) {
                    cameras.forEach((cam, camIdx) => {
                        slotOptions.push(`<option value="${cam.id}">${cam.label || `Cam ${camIdx + 1}`}</option>`);
                    });
                }
                select.innerHTML = slotOptions.join("");
                
                // Set default selected for slots
                if (idx === 0) {
                    select.value = "environment";
                } else if (idx === 1) {
                    select.value = "user";
                } else if (cameras && cameras.length > 0) {
                    const selectedIdx = Math.min(idx - 2, cameras.length - 1);
                    select.value = cameras[selectedIdx].id;
                }
            });
        }).catch(err => {
            console.error("Camera loading error:", err);
            
            // Fallback options in case getCameras fails or is blocked on load
            cameraSelect.innerHTML = `
                <option value="environment">📷 Camera Sau (Mặc định)</option>
                <option value="user">🤳 Camera Trước (Mặc định)</option>
            `;
            
            const slotSelects = document.querySelectorAll(".slot-camera-select");
            slotSelects.forEach((select, idx) => {
                select.innerHTML = `
                    <option value="">Chọn Cam...</option>
                    <option value="environment">📷 Cam Sau</option>
                    <option value="user">🤳 Cam Trước</option>
                `;
                if (idx === 0) select.value = "environment";
                if (idx === 1) select.value = "user";
            });
        });
    }

    // Multi-camera slot actions
    function startSlotScanning(slotId, cameraId) {
        const slotIndex = slotId.split("-")[1];
        const slotEl = document.getElementById(`cam-slot-${slotIndex}`);
        if (!slotEl) return;

        const selectEl = slotEl.querySelector(".slot-camera-select");

        if (!cameraId) {
            showToast("Lỗi camera", `Vui lòng chọn một thiết bị camera cho Cổng ${slotIndex}.`, "error");
            return;
        }

        if (activeScanners[slotId]) {
            stopSlotScanning(slotId).then(() => {
                initSlotCameraScan(slotId, cameraId);
            });
        } else {
            initSlotCameraScan(slotId, cameraId);
        }
    }

    function initSlotCameraScan(slotId, cameraId) {
        const slotIndex = slotId.split("-")[1];
        const slotEl = document.getElementById(`cam-slot-${slotIndex}`);
        if (!slotEl) return;

        const placeholder = slotEl.querySelector(".scanner-placeholder-overlay");
        const stopBtn = slotEl.querySelector(".btn-stop-slot");
        const selectEl = slotEl.querySelector(".slot-camera-select");

        if (placeholder) placeholder.classList.add("hide");
        slotEl.classList.add("active-scanning");
        if (stopBtn) stopBtn.classList.remove("hide");
        if (selectEl) selectEl.setAttribute("disabled", "true");

        const scanner = new Html5Qrcode(`qr-reader-slot-${slotIndex}`, {
            
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: false
            }
        });
        activeScanners[slotId] = scanner;

        let slotScanConfig = {
            fps: 25,
            qrbox: (width, height) => {
                const boxWidth = Math.floor(width * 0.9);
                const boxHeight = Math.floor(height * 0.35);
                return { width: boxWidth, height: boxHeight };
            }
        };

        let startConfig = (cameraId === "environment" || cameraId === "user") ? { facingMode: cameraId } : cameraId;
        
        slotScanConfig.videoConstraints = { width: { ideal: 1920, min: 1280 } };
        
        // CRITICAL FOR iOS: UI must be visible before starting camera

        if (slotEl) {
            const uiOverlay = slotEl.querySelector('.scanner-placeholder-overlay');
            const uiBtn = slotEl.querySelector('.btn-stop-slot');
            if (uiOverlay) uiOverlay.style.display = 'none';
            if (uiBtn) uiBtn.style.display = 'inline-flex';
        }

        let startPromise = scanner.start(
            startConfig,
            slotScanConfig,
            (decodedText) => handleSlotCheckIn(slotId, decodedText),
            (errorMessage) => { /* silently ignore */ }
        );

        startPromise.then(() => {
            if (selectEl) selectEl.removeAttribute("disabled");
            setTimeout(() => {
                try {
                    const videoEl = document.querySelector(`#qr-reader-slot-${slotIndex} video`);
                    if (videoEl && videoEl.srcObject) {
                        const track = videoEl.srcObject.getVideoTracks()[0];
                        const caps = track.getCapabilities();
                        const constraints = { advanced: [] };
                        let apply = false;
                        if (caps.focusMode && caps.focusMode.includes('continuous')) {
                            constraints.focusMode = 'continuous';
                            apply = true;
                        }
                        if (caps.zoom) {
                            const zoomVal = Math.min(caps.zoom.max, Math.max(caps.zoom.min, 2.0));
                            constraints.advanced.push({ zoom: zoomVal });
                            apply = true;
                        }
                        if (apply) track.applyConstraints(constraints);
                    }
                } catch(e){}
            }, 1500);
        }).catch(err => {
            console.error(`Error starting slot ${slotId}:`, err);
            
            if (typeof startConfig === 'string') {
                console.warn("Failed with deviceId, trying exact environment fallback", err);
                scanner.start({ facingMode: "environment" }, slotScanConfig, 
                    (decodedText) => handleSlotScan(slotId, decodedText), 
                    (errorMessage) => { /* silently ignore */ }
                ).catch(errFallback => {
                    showToast("Lỗi Camera iPhone", `Không thể mở camera Cổng ${slotIndex}. Vui lòng thử Safari.`, "error");
                    stopSlotScanning(slotId);
                });
                return;
            }

            showToast("Lỗi Camera", `Không thể mở camera Cổng ${slotIndex}. Vui lòng đổi thiết bị khác trong danh sách.`, "error");
            stopSlotScanning(slotId);
        });
    }
    function stopSlotScanning(slotId) {
        const slotIndex = slotId.split("-")[1];
        const slotEl = document.getElementById(`cam-slot-${slotIndex}`);
        if (!slotEl) return Promise.resolve();

        const placeholder = slotEl.querySelector(".scanner-placeholder-overlay");
        const stopBtn = slotEl.querySelector(".btn-stop-slot");
        const selectEl = slotEl.querySelector(".slot-camera-select");

        slotEl.classList.remove("active-scanning");
        if (placeholder) placeholder.classList.remove("hide");
        if (stopBtn) stopBtn.classList.add("hide");
        if (selectEl) selectEl.removeAttribute("disabled");

        const scanner = activeScanners[slotId];
        if (scanner) {
            return scanner.stop().then(() => {
                activeScanners[slotId] = null;
                const reader = document.getElementById(`qr-reader-slot-${slotIndex}`);
                if (reader) reader.innerHTML = "";
            }).catch(err => {
                console.error(`Failed to stop slot ${slotIndex} scanner gracefully:`, err);
                activeScanners[slotId] = null;
                const reader = document.getElementById(`qr-reader-slot-${slotIndex}`);
                if (reader) reader.innerHTML = "";
            });
        }
        return Promise.resolve();
    }

    // Bind camera controls
    document.getElementById("btn-start-camera").addEventListener("click", () => {
        startScanning();
    });
    document.getElementById("btn-stop-camera").addEventListener("click", () => {
        stopScanning();
    });
    cameraSelect.addEventListener("change", () => {
        if (document.getElementById("single-camera-viewport").classList.contains("active-scanning")) {
            startScanning();
        }
    });

    // Bind Mode switcher controls
    const btnModeSingle = document.getElementById("btn-mode-single");
    const btnModeMulti = document.getElementById("btn-mode-multi");
    const singleCameraViewport = document.getElementById("single-camera-viewport");
    const multiCameraViewport = document.getElementById("multi-camera-viewport");
    const btnStopCamera = document.getElementById("btn-stop-camera");

    btnModeSingle.addEventListener("click", () => {
        if (currentCameraMode === 'single') return;
        currentCameraMode = 'single';
        
        // Stop all multi cameras
        for (let i = 1; i <= 4; i++) {
            stopSlotScanning(`slot-${i}`);
        }

        btnModeSingle.classList.add("active");
        btnModeSingle.style.background = "var(--color-primary)";
        btnModeSingle.style.color = "white";

        btnModeMulti.classList.remove("active");
        btnModeMulti.style.background = "transparent";
        btnModeMulti.style.color = "var(--text-secondary)";

        multiCameraViewport.classList.add("hide");
        singleCameraViewport.classList.remove("hide");
        
        // Show single cam controls
        cameraSelect.classList.remove("hide");
        btnStopCamera.classList.remove("hide");
    });

    btnModeMulti.addEventListener("click", () => {
        if (currentCameraMode === 'multi') return;
        currentCameraMode = 'multi';

        // Stop main single camera
        stopScanning();

        btnModeMulti.classList.add("active");
        btnModeMulti.style.background = "var(--color-primary)";
        btnModeMulti.style.color = "white";

        btnModeSingle.classList.remove("active");
        btnModeSingle.style.background = "transparent";
        btnModeSingle.style.color = "var(--text-secondary)";

        singleCameraViewport.classList.add("hide");
        multiCameraViewport.classList.remove("hide");

        // Hide single cam controls
        cameraSelect.classList.add("hide");
        btnStopCamera.classList.add("hide");
    });

    // Bind multi-camera slot controls
    for (let i = 1; i <= 4; i++) {
        const slotId = `slot-${i}`;
        const slotEl = document.getElementById(`cam-slot-${i}`);
        if (slotEl) {
            const startBtn = slotEl.querySelector(".btn-start-slot");
            const stopBtn = slotEl.querySelector(".btn-stop-slot");
            const selectEl = slotEl.querySelector(".slot-camera-select");

            startBtn.addEventListener("click", () => {
                const cameraId = selectEl.value;
                startSlotScanning(slotId, cameraId);
            });

            stopBtn.addEventListener("click", () => {
                stopSlotScanning(slotId);
            });

            selectEl.addEventListener("change", () => {
                if (slotEl.classList.contains("active-scanning")) {
                    const cameraId = selectEl.value;
                    startSlotScanning(slotId, cameraId);
                }
            });
        }
    }

    // ----------------------------------------------------------------------
    // X. CHECK-IN CORE PROCESS
    // ----------------------------------------------------------------------
    const scanDetailsEl = document.getElementById("scan-customer-details");

    let isProcessingCheckin = false; // Lock to prevent multiple scans within 2 seconds

    function handleCheckIn(qrData, slotId = null) {
        if (isProcessingCheckin) return;
        isProcessingCheckin = true;

        // Visual flash lock delay
        setTimeout(() => {
            isProcessingCheckin = false;
        }, 2500);

        // QR values could be URLs containing QR content, or plain tickets like "QRCHECKIN-TIC-8801" or "TIC-8801"
        let ticketId = String(qrData || "").trim();
        
        // If the scanned data looks like a URL, try to extract data/chl parameter
        if (ticketId.startsWith("http://") || ticketId.startsWith("https://")) {
            try {
                const urlObj = new URL(ticketId);
                const dataParam = urlObj.searchParams.get("data") || urlObj.searchParams.get("chl");
                if (dataParam) {
                    ticketId = decodeURIComponent(dataParam).trim();
                }
            } catch (err) {
                console.warn("Failed to parse scanned URL:", err);
            }
        }

        const cleanQrData = ticketId;

        // Strip prefix case-insensitively
        if (ticketId.toUpperCase().startsWith("QRCHECKIN-")) {
            ticketId = ticketId.substring(10);
        }

        const customer = state.customers.find(c => 
            (c.id && c.id.toLowerCase() === ticketId.toLowerCase()) || 
            (c.qrCode && c.qrCode.toLowerCase() === cleanQrData.toLowerCase())
        );

        if (!customer) {
            // ERROR: CUSTOMER NOT FOUND
            playNotificationSound("error");
            flashScannerOverlay("error", "Mã không hợp lệ", "Mã vé không tồn tại trong sự kiện!", slotId);
            showToast("Vé không hợp lệ", `Quét mã: "${qrData}" thất bại. Vé không tồn tại.`, "error");
            return;
        }

        const location = locationSelect.value || "Lối vào chính";
        const currentStaff = state.currentUser ? state.currentUser.name : "Nhân viên trực";

        if (customer.status === "Checked In") {
            // WARN: ALREADY CHECKED-IN
            playNotificationSound("error");
            
            const checkedTime = new Date(customer.checkInTime).toLocaleTimeString('vi-VN');
            const alertText = `${customer.HoVaTen} đã check-in lúc ${checkedTime} tại ${customer.checkInLocation}`;
            
            flashScannerOverlay("error", "Đã check-in", alertText, slotId);
            showToast("Đã check-in trước đó", alertText, "warning");
            
            renderScannedCard(customer, true);
            return;
        }

        // SUCCESS: MARK AS CHECKED-IN
        customer.status = "Checked In";
        customer.checkInTime = new Date().toISOString();
        customer.checkInLocation = location;
        customer.checkedBy = currentStaff;

        // Log Checkin History Event
        const logRecord = {
            id: "log-" + Date.now() + Math.random().toString(36).substr(2, 4),
            customerId: customer.id,
            customerName: customer.HoVaTen,
            checkInTime: customer.checkInTime,
            location: location,
            checkedBy: currentStaff
        };

        state.logs.push(logRecord);
        sessionCount++;

        // Save
        saveState("customers");
        saveState("logs");

        // Sync with Google Sheets in background if enabled
        if (state.settings.sheets && state.settings.sheets.enabled && state.settings.sheets.scriptUrl) {
            postCheckInToGoogleSheets(customer);
        }

        // UI Feedback
        playNotificationSound("success");
        flashScannerOverlay("success", "Check-in thành công!", customer.HoVaTen, slotId);
        showToast("Check-in thành công", `${customer.HoVaTen} (${customer.TruongTHPT}) tại ${location}`, "success");
        
        logActivity("success", "Check-in thành công", `${customer.HoVaTen} đã được quét thành công tại ${location} bởi ${currentStaff}`);
        
        renderScannedCard(customer, false);
        updateSessionCounter();
    }

    function flashScannerOverlay(type, title, desc, slotId = null) {
        let overlaySuccess, overlayFail;
        if (slotId) {
            const slotIndex = slotId.split("-")[1];
            const slotEl = document.getElementById(`cam-slot-${slotIndex}`);
            overlaySuccess = slotEl.querySelector(".scanner-result-overlay.success");
            overlayFail = slotEl.querySelector(".scanner-result-overlay.error");
        } else {
            overlaySuccess = document.getElementById("scanner-result-overlay");
            overlayFail = document.getElementById("scanner-result-overlay-fail");
        }

        if (!overlaySuccess || !overlayFail) return;

        if (type === "success") {
            overlaySuccess.querySelector(".overlay-title").textContent = title;
            overlaySuccess.querySelector(".overlay-text").textContent = desc;
            overlaySuccess.classList.remove("hide");
            
            setTimeout(() => {
                overlaySuccess.classList.add("hide");
            }, 2500);
        } else {
            overlayFail.querySelector(".overlay-title").textContent = title;
            overlayFail.querySelector(".overlay-text").textContent = desc;
            overlayFail.classList.remove("hide");
            
            setTimeout(() => {
                overlayFail.classList.add("hide");
            }, 2500);
        }
    }

    function renderScannedCard(cust, alreadyCheckedIn = false) {
        const timeString = cust.checkInTime ? new Date(cust.checkInTime).toLocaleTimeString('vi-VN') : 'N/A';
        const dateString = cust.checkInTime ? new Date(cust.checkInTime).toLocaleDateString('vi-VN') : '';

        // Collect custom fields
        const systemKeys = ["id", "qrCode", "status", "checkInTime", "checkInLocation", "checkedBy", "HoVaTen", "SoDienThoai", "Email"];
        const customKeys = Object.keys(cust).filter(k => !systemKeys.includes(k));

        let customFieldsHtml = "";
        customKeys.forEach(key => {
            const val = cust[key] !== undefined && cust[key] !== null ? cust[key] : 'N/A';
            customFieldsHtml += `
                <div class="scan-grid-item">
                    <span>${key}</span>
                    <strong style="font-weight: 500; font-size: 13px; line-height: 1.4;">${val}</strong>
                </div>
            `;
        });

        scanDetailsEl.innerHTML = `
            <div class="scan-card">
                <div class="scan-card-header">
                    <div>
                        <h4 class="scan-card-title">${cust.HoVaTen || 'N/A'}</h4>
                        <span class="scan-card-subtitle">Mã Vé: ${cust.id}</span>
                    </div>
                    <span class="badge-type standard" style="background: ${alreadyCheckedIn ? 'var(--color-warning-alpha)' : 'var(--color-success-alpha)'}; color: ${alreadyCheckedIn ? 'var(--color-warning)' : 'var(--color-success)'};">
                        ${cust.status === 'Checked In' ? 'Đã Quét' : 'Chờ Quét'}
                    </span>
                </div>
                
                <div class="scan-grid-details">
                    <div class="scan-grid-item">
                        <span>Số Điện Thoại</span>
                        <strong>${cust.SoDienThoai || 'N/A'}</strong>
                    </div>
                    <div class="scan-grid-item">
                        <span>Email liên hệ</span>
                        <strong>${cust.Email || 'N/A'}</strong>
                    </div>
                    
                    <!-- Custom columns of this event -->
                    ${customFieldsHtml}
                    
                    <div class="scan-grid-item">
                        <span>Trạng thái</span>
                        <strong class="${alreadyCheckedIn ? 'text-amber' : 'text-emerald'}">
                            <i class="ri-checkbox-circle-fill"></i> ĐÃ CHECK-IN
                        </strong>
                    </div>
                    <div class="scan-grid-item">
                        <span>Thời gian</span>
                        <strong>${timeString} ${dateString}</strong>
                    </div>
                    <div class="scan-grid-item">
                        <span>Địa điểm</span>
                        <strong>${cust.checkInLocation || 'N/A'}</strong>
                    </div>
                    <div class="scan-grid-item">
                        <span>Nhân viên</span>
                        <strong>${cust.checkedBy || 'N/A'}</strong>
                    </div>
                </div>
            </div>
        `;
    }

    function updateSessionCounter() {
        sessionCountEl.textContent = sessionCount;
        
        const logsList = [...state.logs].filter(log => log.checkedBy === (state.currentUser ? state.currentUser.name : "Nhân viên trực")).slice(-5).reverse();
        
        if (logsList.length === 0) {
            sessionLogsEl.innerHTML = `<div class="text-muted text-center py-20">Chưa ghi nhận ca trực này.</div>`;
            return;
        }

        sessionLogsEl.innerHTML = logsList.map(log => {
            const timeString = new Date(log.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            return `
                <div class="flex-align-center justify-between py-10" style="border-bottom: 1px solid var(--border-glass)">
                    <div>
                        <strong>${log.customerName}</strong>
                        <span class="text-muted font-12 block">${log.customerId} | ${timeString}</span>
                    </div>
                    <span class="badge-status badge-success select-sm">${log.location}</span>
                </div>
            `;
        }).join("");
    }

    // Manual Ticket check-in handler
    const manualForm = document.getElementById("manual-checkin-form");
    manualForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const code = document.getElementById("manual-ticket-id").value.trim();
        if (code) {
            handleCheckIn(code);
            document.getElementById("manual-ticket-id").value = "";
        }
    });
    
    // Walk-in modal selectors and handlers
    const btnQuickWalkin = document.getElementById("btn-quick-walkin");
    const modalQuickWalkin = document.getElementById("modal-quick-walkin");
    const btnCloseWalkin = document.getElementById("btn-close-walkin-modal");
    const btnCancelWalkin = document.getElementById("btn-cancel-walkin-modal");
    const walkinForm = document.getElementById("walkin-form");

    // Open Walk-in Modal
    btnQuickWalkin.addEventListener("click", () => {
        walkinForm.reset();
        modalQuickWalkin.classList.add("active");
    });

    // Close Walk-in Modal
    const closeWalkinModal = () => {
        modalQuickWalkin.classList.remove("active");
    };
    btnCloseWalkin.addEventListener("click", closeWalkinModal);
    btnCancelWalkin.addEventListener("click", closeWalkinModal);

    // Walk-in Form Submit Handler
    walkinForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const name = document.getElementById("w-name").value.trim();
        const phone = document.getElementById("w-phone").value.trim();
        const email = document.getElementById("w-email").value.trim();
        const school = document.getElementById("w-school").value.trim();
        const englishCert = document.getElementById("w-english-cert").value.trim() || "Không";

        const location = locationSelect.value || "Lối vào chính";
        const currentStaff = state.currentUser ? state.currentUser.name : "Nhân viên trực";

        // Generate unique Ticket ID starting with TIC-W (deterministic)
        const ticketId = generateDeterministicId(name, phone, email, true);

        // Create new customer
        const newCust = {
            id: ticketId,
            HoVaTen: name,
            SoDienThoai: phone,
            Email: email,
            TruongTHPT: school,
            ChungChiTiengAnh: englishCert,
            ChungChiTuyenSinhQuocTe: "Không",
            TraiNghiemHoatDong: "Đăng ký trực tiếp tại quầy check-in (Khách vãng lai)",
            status: "Checked In",
            qrCode: `QRCHECKIN-${ticketId}`,
            checkInTime: new Date().toISOString(),
            checkInLocation: location,
            checkedBy: currentStaff
        };

        // Create log record
        const logRecord = {
            id: "log-" + Date.now() + Math.random().toString(36).substr(2, 4),
            customerId: ticketId,
            customerName: name,
            checkInTime: newCust.checkInTime,
            location: location,
            checkedBy: currentStaff
        };

        // Push to state
        state.customers.push(newCust);
        state.logs.push(logRecord);
        sessionCount++;

        // Save State
        saveState("customers");
        saveState("logs");

        if (state.settings.sheets && state.settings.sheets.enabled && state.settings.sheets.scriptUrl) {
            postNewCustomerToGoogleSheets(newCust);
        }

        // Queue simulated email
        queueSimulatedEmail(newCust);

        // UI Feedback
        playNotificationSound("success");
        flashScannerOverlay("success", "Đăng ký thành công!", name);
        showToast("Đăng ký thành công", `Khách vãng lai: ${name} (${school}) đã được check-in.`, "success");
        logActivity("success", "Đăng ký khách vãng lai", `${name} đã đăng ký trực tiếp và check-in tại ${location} bởi ${currentStaff}`);

        // Update scanned view
        renderScannedCard(newCust, false);
        updateSessionCounter();

        // Refresh stats/tables in other views
        renderDashboard();
        renderCustomersTable();

        // Close modal
        closeWalkinModal();
    });

    // ----------------------------------------------------------------------
    // XI. CUSTOMERS MANAGEMENT & QR GENERATION & EXCEL IMPORT
    // ----------------------------------------------------------------------
    const customerTableBody = document.getElementById("customer-table-body");
    const customerSearch = document.getElementById("customer-search-input");
    const filterType = document.getElementById("customer-filter-type");
    const filterStatus = document.getElementById("customer-filter-status");

    function renderCustomersTable() {
        const query = customerSearch.value.toLowerCase();
        const type = filterType.value;
        const status = filterStatus.value;

        // General query matching across all string fields of the customer object
        let filtered = state.customers.filter(cust => {
            const matchQuery = Object.keys(cust).some(key => {
                if (["qrCode", "status", "checkInTime", "checkInLocation", "checkedBy", "_rowNum"].includes(key)) return false;
                return String(cust[key] || "").toLowerCase().includes(query);
            });

            let matchType = true;
            if (type !== "") {
                const english = (cust.ChungChiTiengAnh || "").trim().toLowerCase();
                const international = (cust.ChungChiTuyenSinhQuocTe || "").trim().toLowerCase();
                const hasEnglish = english !== "" && english !== "không" && english !== "none" && english !== "no" && english !== "n/a";
                const hasIntl = international !== "" && international !== "không" && international !== "none" && international !== "no" && international !== "n/a";

                if (type === "english") matchType = hasEnglish;
                else if (type === "international") matchType = hasIntl;
                else if (type === "both") matchType = hasEnglish && hasIntl;
                else if (type === "none") matchType = !hasEnglish && !hasIntl;
            }

            const matchStatus = status === "" || cust.status === status;

            return matchQuery && matchType && matchStatus;
        });

        // Set counts
        document.getElementById("customer-list-count").textContent = `${filtered.length} người`;

        // Identify custom columns to render dynamically (max 4 columns)
        const systemKeys = ["id", "qrCode", "status", "checkInTime", "checkInLocation", "checkedBy", "HoVaTen", "SoDienThoai", "Email"];
        let customKeys = [];
        state.customers.forEach(cust => {
            Object.keys(cust).forEach(key => {
                if (!systemKeys.includes(key) && !customKeys.includes(key)) {
                    customKeys.push(key);
                }
            });
        });
        const maxCustomCols = 4;
        const colsToShow = customKeys.slice(0, maxCustomCols);

        // Dynamically build headers
        const headerRow = `
            <tr>
                <th>Mã Vé</th>
                <th>Họ và Tên</th>
                <th>Số Điện Thoại</th>
                <th>Email</th>
                ${colsToShow.map(col => `<th>${col}</th>`).join("")}
                <th>Check-In</th>
                <th class="text-right">Hành Động</th>
            </tr>
        `;
        document.getElementById("customer-table-header").innerHTML = headerRow;

        if (filtered.length === 0) {
            customerTableBody.innerHTML = `
                <tr>
                    <td colspan="${6 + colsToShow.length}" class="text-center text-muted">Không tìm thấy học sinh nào khớp với điều kiện lọc.</td>
                </tr>
            `;
            return;
        }

        customerTableBody.innerHTML = filtered.map(cust => {
            const customCells = colsToShow.map(col => {
                const val = cust[col] !== undefined && cust[col] !== null ? cust[col] : 'N/A';
                return `<td class="font-12" style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${val}">${val}</td>`;
            }).join("");

            return `
                <tr>
                    <td><strong>${cust.id}</strong></td>
                    <td><strong>${cust.HoVaTen}</strong></td>
                    <td>${cust.SoDienThoai || 'N/A'}</td>
                    <td>${cust.Email || 'N/A'}</td>
                    ${customCells}
                    <td>
                        <span class="badge-chk ${cust.status === 'Checked In' ? 'checked' : 'pending'}">
                            <i class="${cust.status === 'Checked In' ? 'ri-checkbox-circle-line' : 'ri-time-line'}"></i>
                            ${cust.status === 'Checked In' ? 'Đã Quét' : 'Chờ Quét'}
                        </span>
                    </td>
                    <td class="text-right">
                        <div class="justify-end gap-10">
                            <button class="btn-icon btn-secondary btn-sm btn-view-ticket" data-id="${cust.id}" title="Xem Vé QR">
                                <i class="ri-qr-code-line"></i>
                            </button>
                            <button class="btn-icon btn-secondary btn-sm btn-edit-customer" data-id="${cust.id}" title="Sửa thông tin" data-admin-only>
                                <i class="ri-edit-line"></i>
                            </button>
                            <button class="btn-icon btn-secondary btn-sm text-danger btn-delete-customer" data-id="${cust.id}" title="Xóa" data-admin-only>
                                <i class="ri-delete-bin-line"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        // Reapply RBAC classes to newly rendered buttons
        applyRBAC(state.currentUser ? state.currentUser.role : 'user');

        // Bind Customer row actions
        bindCustomerActions();
    }

    customerSearch.addEventListener("input", renderCustomersTable);
    filterType.addEventListener("change", renderCustomersTable);
    filterStatus.addEventListener("change", renderCustomersTable);

    function bindCustomerActions() {
        // View ticket modal
        document.querySelectorAll(".btn-view-ticket").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const cust = state.customers.find(c => c.id === id);
                if (cust) openTicketPreviewModal(cust);
            });
        });

        // Edit customer modal
        document.querySelectorAll(".btn-edit-customer").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const cust = state.customers.find(c => c.id === id);
                if (cust) openCustomerFormModal("edit", cust);
            });
        });

        // Delete customer
        document.querySelectorAll(".btn-delete-customer").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const idx = state.customers.findIndex(c => c.id === id);
                if (idx !== -1) {
                    if (confirm(`Bạn có chắc chắn muốn xóa khách hàng "${state.customers[idx].name}"?`)) {
                        const name = state.customers[idx].name;
                        state.customers.splice(idx, 1);
                        saveState("customers");
                        
                        // Also remove logs relating to this customer
                        state.logs = state.logs.filter(l => l.customerId !== id);
                        saveState("logs");

                        showToast("Đã xóa", `Đã xóa thành công khách hàng "${name}".`, "info");
                        renderCustomersTable();
                    }
                }
            });
        });
    }

    // Modal Customer Form handlers
    const modalCustomer = document.getElementById("modal-customer");
    const customerForm = document.getElementById("customer-form");
    const cModalTitle = document.getElementById("customer-modal-title");

    function openCustomerFormModal(mode = "add", cust = null) {
        document.getElementById("customer-form-mode").value = mode;
        customerForm.reset();

        if (mode === "add") {
            cModalTitle.textContent = "Thêm Học Sinh Mới";
            document.getElementById("customer-form-id").value = "";
            document.getElementById("btn-submit-customer-modal").textContent = "Thêm Học Sinh";
        } else {
            cModalTitle.textContent = "Cập Nhật Học Sinh";
            document.getElementById("customer-form-id").value = cust.id;
            document.getElementById("c-name").value = cust.HoVaTen;
            document.getElementById("c-phone").value = cust.SoDienThoai;
            document.getElementById("c-email").value = cust.Email;
            document.getElementById("c-school").value = cust.TruongTHPT || "";
            document.getElementById("c-english-cert").value = cust.ChungChiTiengAnh || "";
            document.getElementById("c-admission-cert").value = cust.ChungChiTuyenSinhQuocTe || "";
            document.getElementById("c-activity-exp").value = cust.TraiNghiemHoatDong || "";
            document.getElementById("btn-submit-customer-modal").textContent = "Lưu Thay Đổi";
        }

        modalCustomer.classList.add("active");
    }

    function closeCustomerFormModal() {
        modalCustomer.classList.remove("active");
    }

    document.getElementById("btn-add-customer").addEventListener("click", () => openCustomerFormModal("add"));
    document.getElementById("btn-close-customer-modal").addEventListener("click", closeCustomerFormModal);
    document.getElementById("btn-cancel-customer-modal").addEventListener("click", closeCustomerFormModal);

    customerForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const mode = document.getElementById("customer-form-mode").value;
        const HoVaTen = document.getElementById("c-name").value.trim();
        const SoDienThoai = document.getElementById("c-phone").value.trim();
        const Email = document.getElementById("c-email").value.trim();
        const TruongTHPT = document.getElementById("c-school").value.trim();
        const ChungChiTiengAnh = document.getElementById("c-english-cert").value.trim() || "Không";
        const ChungChiTuyenSinhQuocTe = document.getElementById("c-admission-cert").value.trim() || "Không";
        const TraiNghiemHoatDong = document.getElementById("c-activity-exp").value.trim() || "Chưa có";

        if (mode === "add") {
            // Generate ticket ID (deterministic)
            const ticketId = generateDeterministicId(HoVaTen, SoDienThoai, Email, false);

            // Check if student already exists in the system
            const isDuplicate = state.customers.some(c => c.id === ticketId);
            if (isDuplicate) {
                showToast("Lỗi tạo học sinh", "Học sinh này đã tồn tại trong hệ thống (trùng Tên, SĐT hoặc Email).", "warning");
                return;
            }
            
            const newCust = {
                id: ticketId,
                HoVaTen,
                SoDienThoai,
                Email,
                TruongTHPT,
                ChungChiTiengAnh,
                ChungChiTuyenSinhQuocTe,
                TraiNghiemHoatDong,
                status: "Pending",
                qrCode: `QRCHECKIN-${ticketId}`,
                checkInTime: null,
                checkInLocation: null,
                checkedBy: null
            };

            state.customers.push(newCust);
            saveState("customers");
            
            // Sync with Google Sheets in background if enabled
            if (state.settings.sheets && state.settings.sheets.enabled && state.settings.sheets.scriptUrl) {
                postNewCustomerToGoogleSheets(newCust);
            }
            
            // Queue simulated outbox email
            queueSimulatedEmail(newCust);
            showToast("Đã tạo học sinh", `Đã lưu thành công "${HoVaTen}". Email thẻ QR đang được chuẩn bị.`, "success");
            logActivity("info", "Tạo học sinh mới", `Nhân viên đã tạo học sinh ${HoVaTen} (${TruongTHPT})`);
        } else {
            const id = document.getElementById("customer-form-id").value;
            const cust = state.customers.find(c => c.id === id);
            if (cust) {
                cust.HoVaTen = HoVaTen;
                cust.SoDienThoai = SoDienThoai;
                cust.Email = Email;
                cust.TruongTHPT = TruongTHPT;
                cust.ChungChiTiengAnh = ChungChiTiengAnh;
                cust.ChungChiTuyenSinhQuocTe = ChungChiTuyenSinhQuocTe;
                cust.TraiNghiemHoatDong = TraiNghiemHoatDong;

                saveState("customers");
                showToast("Cập nhật thành công", `Đã sửa đổi thông tin cho học sinh "${HoVaTen}".`, "success");
                logActivity("info", "Cập nhật thông tin", `Sửa đổi thông tin học sinh ${HoVaTen} (${id})`);
            }
        }

        closeCustomerFormModal();
        renderCustomersTable();
    });

    // ----------------------------------------------------------------------
    // XII. TICKET PREVIEW & QR GENERATION MODAL
    // ----------------------------------------------------------------------
    const modalTicket = document.getElementById("modal-ticket-preview");
    const ticketQrEl = document.getElementById("ticket-qr-renderer");
    let currentPreviewCustomer = null;

    function openTicketPreviewModal(cust) {
        currentPreviewCustomer = cust;
        document.getElementById("ticket-cust-name").textContent = cust.HoVaTen;
        document.getElementById("ticket-cust-company").textContent = cust.TruongTHPT ? `Trường: ${cust.TruongTHPT}` : "N/A";
        document.getElementById("ticket-cust-id").textContent = cust.id;
        
        const typeEl = document.getElementById("ticket-cust-type");
        const certBadge = cust.ChungChiTiengAnh && cust.ChungChiTiengAnh.toLowerCase() !== 'không' ? cust.ChungChiTiengAnh : (cust.ChungChiTuyenSinhQuocTe && cust.ChungChiTuyenSinhQuocTe.toLowerCase() !== 'không' ? cust.ChungChiTuyenSinhQuocTe : 'Học sinh');
        typeEl.textContent = certBadge;
        typeEl.className = `ticket-type-tag standard`;

        const statusEl = document.getElementById("ticket-cust-status");
        if (cust.status === "Checked In") {
            statusEl.textContent = "ĐÃ CHECK-IN";
            statusEl.className = "t-val text-emerald";
        } else {
            statusEl.textContent = "CHỜ QUÉT VÉ";
            statusEl.className = "t-val text-amber";
        }

        // Clean out previous QR
        ticketQrEl.innerHTML = "";
        
        // Generate QR code inside
        new QRCode(ticketQrEl, {
            text: cust.qrCode,
            width: 140,
            height: 140,
            colorDark: "#090a10",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

        // Generate Barcode inside
        try {
            const idLength = String(cust.id).length;
            const barcodeWidth = idLength > 12 ? 1.2 : (idLength > 9 ? 1.5 : 1.8);
            JsBarcode("#ticket-barcode-renderer", cust.id, {
                format: "CODE39",
                width: barcodeWidth,
                height: 55,
                displayValue: true,
                fontSize: 12,
                textMargin: 3,
                margin: 15,
                background: "#ffffff",
                lineColor: "#090a10"
            });
        } catch (bErr) {
            console.error("Barcode rendering error:", bErr);
        }

        modalTicket.classList.add("active");
    }

    function closeTicketPreviewModal() {
        modalTicket.classList.remove("active");
        currentPreviewCustomer = null;
    }

    document.getElementById("btn-close-ticket-modal").addEventListener("click", closeTicketPreviewModal);

    // Print Ticket / Save PDF Action via Native @media print
    document.getElementById("btn-print-ticket").addEventListener("click", () => {
        window.print();
    });

    document.getElementById("btn-send-single-email-preview").addEventListener("click", () => {
        if (currentPreviewCustomer) {
            queueSimulatedEmail(currentPreviewCustomer, true);
        }
    });

    // ----------------------------------------------------------------------
    // XIII. EXCEL / CSV DRAG-N-DROP & PAPAPARSE IMPORT
    // ----------------------------------------------------------------------
    const excelFileInput = document.getElementById("excel-file-input");
    const dropZone = document.getElementById("drop-zone");

    document.getElementById("btn-trigger-import").addEventListener("click", () => {
        excelFileInput.click();
    });

    excelFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) handleUploadFile(file);
    });

    // Drag-n-drop listeners
    document.body.addEventListener("dragenter", (e) => {
        if (state.currentView === "customers" && state.currentUser && state.currentUser.role === 'admin') {
            e.preventDefault();
            dropZone.classList.remove("hide");
        }
    });

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
    });

    dropZone.addEventListener("dragleave", (e) => {
        e.preventDefault();
        dropZone.classList.add("hide");
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.add("hide");
        
        if (state.currentView === "customers" && state.currentUser && state.currentUser.role === 'admin') {
            const file = e.dataTransfer.files[0];
            if (file) handleUploadFile(file);
        }
    });

    // Shared columns possibles for Excel and Google Sheets mapping
    const namePossibles = ["HoVaTen", "Họ tên", "Họ và tên", "Họ và Tên", "Name", "Full Name", "Khách hàng", "Tên khách hàng", "Học sinh", "Tên học sinh"];
    const phonePossibles = ["SoDienThoai", "Số điện thoại", "SĐT", "Phone", "SDT", "Số ĐT", "Điện thoại", "Telephone"];
    const emailPossibles = ["Email", "Mail", "Địa chỉ email", "Gmail"];
    const idPossibles = ["Mã số sinh viên", "Mã số cán bộ", "MSSV", "MSCB", "Mã số", "Mã Vé / ID", "Mã Vé", "ID", "Id", "id", "Mã Số Vé", "Mã Số Vé / ID", "Mã vé / ID", "Ticket ID", "TicketID", "Mã số", "Mã"];

    const findBestMatch = (headers, possibles) => {
        // Exact match first
        for (const p of possibles) {
            const match = headers.find(h => String(h).trim().toLowerCase() === p.toLowerCase());
            if (match) return match;
        }
        // Normalized match
        const normalize = (s) => String(s || "").toLowerCase().replace(/\s+/g, "").normalize("NFD").replace(/[̀-ͯ]/g, "");
        const normPossibles = possibles.map(p => normalize(p));
        for (const h of headers) {
            const normH = normalize(h);
            if (normPossibles.includes(normH)) return h;
        }
        return "";
    };

    const modalColumnMapping = document.getElementById("modal-column-mapping");
    const columnMappingForm = document.getElementById("column-mapping-form");
    const mapNameSelect = document.getElementById("map-name");
    const mapPhoneSelect = document.getElementById("map-phone");
    const mapEmailSelect = document.getElementById("map-email");
    const mapIdSelect = document.getElementById("map-id");

    // Close Mapping Modal
    document.getElementById("btn-close-mapping-modal").addEventListener("click", () => {
        modalColumnMapping.classList.remove("active");
        excelFileInput.value = "";
    });
    document.getElementById("btn-cancel-mapping").addEventListener("click", () => {
        modalColumnMapping.classList.remove("active");
        excelFileInput.value = "";
    });

    // Form Mapping Submit
    columnMappingForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const nameCol = mapNameSelect.value;
        const phoneCol = mapPhoneSelect.value;
        const emailCol = mapEmailSelect.value;
        const idCol = mapIdSelect.value;

        if (!nameCol) {
            alert("Vui lòng chọn cột chứa Họ và Tên!");
            return;
        }

        // Save column mapping configuration
        state.settings.columnMapping = {
            name: nameCol,
            phone: phoneCol,
            email: emailCol,
            id: idCol
        };
        saveState("settings");

        let newCount = 0;
        let updateCount = 0;
        let totalRowsProcessed = 0;
        const tempImported = [];

        state.currentImportRows.forEach(row => {
            const HoVaTen = nameCol ? String(row[nameCol] || "").trim() : "";
            if (HoVaTen === "") return;

            const SoDienThoai = phoneCol ? String(row[phoneCol] || "").trim() : "";
            const Email = emailCol ? String(row[emailCol] || "").trim() : "";
            const ImportedId = idCol ? String(row[idCol] || "").trim() : "";

            // Robust checkin fields checking (if present in imported sheet)
            const getRowValue = (r, possibles) => {
                for (const p of possibles) {
                    if (r[p] !== undefined && r[p] !== null) return String(r[p]).trim();
                }
                return "";
            };

            const ImportedStatus = getRowValue(row, ["Trạng Thái Check-in", "Trạng Thái", "Trạng thái check-in", "Trạng thái", "Status", "Check-in Status", "Trạng Thái Checkin"]);
            const ImportedCheckInTime = getRowValue(row, ["Thời Gian Check-in", "Thời gian check-in", "Thời gian", "Check-in Time", "Checkin Time", "Time", "Thời Gian Checkin"]);
            const ImportedCheckInLocation = getRowValue(row, ["Địa Điểm Check-in", "Địa điểm check-in", "Địa điểm", "Location", "Check-in Location", "Địa Điểm Checkin"]);
            const ImportedCheckedBy = getRowValue(row, ["Nhân Viên Check-in", "Nhân Viên", "Nhân viên check-in", "Checked By", "Staff", "User", "Nhân Viên Soát Vé", "NhanVienCheckin"]);
            const ImportedQr = getRowValue(row, ["Nội Dung Mã QR", "Mã QR", "QRCode", "QR Content", "Nội dung QR", "QR Code", "QR"]);

            totalRowsProcessed++;

            // 1. Check if we already have it in our tempImported list for this batch
            let existing = tempImported.find(c =>
                (ImportedId !== "" && c.id === ImportedId) ||
                (isValidMatchValue(Email) && isValidMatchValue(c.Email) && Email.toLowerCase() === c.Email.toLowerCase()) ||
                (isValidMatchValue(SoDienThoai) && isValidMatchValue(c.SoDienThoai) && normalizePhone(SoDienThoai) === normalizePhone(c.SoDienThoai))
            );

            // 2. If not, check if they exist in the global database
            let isFromGlobal = false;
            if (!existing) {
                existing = state.customers.find(c =>
                    (ImportedId !== "" && c.id === ImportedId) ||
                    (isValidMatchValue(Email) && isValidMatchValue(c.Email) && Email.toLowerCase() === c.Email.toLowerCase()) ||
                    (isValidMatchValue(SoDienThoai) && isValidMatchValue(c.SoDienThoai) && normalizePhone(SoDienThoai) === normalizePhone(c.SoDienThoai))
                );
                if (existing) {
                    isFromGlobal = true;
                    tempImported.push(existing);
                }
            }

            if (existing) {
                // MERGE VALUES
                if (isPlaceholder(existing.SoDienThoai) && !isPlaceholder(SoDienThoai)) {
                    existing.SoDienThoai = SoDienThoai;
                }
                if (isPlaceholder(existing.Email) && !isPlaceholder(Email)) {
                    existing.Email = Email;
                }

                // Merge all other non-system columns as custom properties directly on customer
                state.currentImportHeaders.forEach(h => {
                    if (h !== nameCol && h !== phoneCol && h !== emailCol && h !== idCol) {
                        if (row[h] !== undefined && row[h] !== null && String(row[h]).trim() !== "") {
                            existing[h] = String(row[h]).trim();
                        }
                    }
                });

                // Check-in status merge
                const cleanImportedStatus = ImportedStatus.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
                const isImportedCheckedIn = (cleanImportedStatus === "da check-in" || cleanImportedStatus === "da checkin" || cleanImportedStatus === "checked in" || cleanImportedStatus === "checkedin" || cleanImportedStatus === "da quet" || cleanImportedStatus === "da quet ve");

                if (isImportedCheckedIn) {
                    const parsedTime = ImportedCheckInTime !== "" ? (isNaN(Date.parse(ImportedCheckInTime)) ? new Date().toISOString() : new Date(ImportedCheckInTime).toISOString()) : new Date().toISOString();
                    const parsedLocation = ImportedCheckInLocation !== "" ? ImportedCheckInLocation : "Lối vào chính";
                    const parsedCheckedBy = ImportedCheckedBy !== "" ? ImportedCheckedBy : "Nhân viên trực";

                    if (existing.status !== "Checked In") {
                        existing.status = "Checked In";
                        existing.checkInTime = parsedTime;
                        existing.checkInLocation = parsedLocation;
                        existing.checkedBy = parsedCheckedBy;
                    } else {
                        // Keep earlier check-in
                        if (existing.checkInTime && parsedTime) {
                            if (new Date(parsedTime) < new Date(existing.checkInTime)) {
                                existing.checkInTime = parsedTime;
                                existing.checkInLocation = parsedLocation;
                                existing.checkedBy = parsedCheckedBy;
                            }
                        }
                    }

                    // Ensure a log record exists
                    const logExists = state.logs.some(l => l.customerId === existing.id);
                    if (!logExists) {
                        const logRecord = {
                            id: "log-" + Date.now() + Math.random().toString(36).substr(2, 4),
                            customerId: existing.id,
                            customerName: existing.HoVaTen,
                            checkInTime: existing.checkInTime,
                            location: existing.checkInLocation,
                            checkedBy: existing.checkedBy
                        };
                        state.logs.push(logRecord);
                    }
                }

                if (isFromGlobal && !existing._updatedThisBatch) {
                    existing._updatedThisBatch = true;
                    updateCount++;
                }
            } else {
                // CREATE NEW STUDENT (Use existing ID from sheet if present, else generate deterministically)
                const ticketId = ImportedId !== "" ? ImportedId : generateDeterministicId(HoVaTen, SoDienThoai, Email, false);
                const qrCode = ImportedQr !== "" ? ImportedQr : `QRCHECKIN-${ticketId}`;

                let status = "Pending";
                let checkInTime = null;
                let checkInLocation = null;
                let checkedBy = null;

                const cleanImportedStatus = ImportedStatus.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
                const isImportedCheckedIn = (cleanImportedStatus === "da check-in" || cleanImportedStatus === "da checkin" || cleanImportedStatus === "checked in" || cleanImportedStatus === "checkedin" || cleanImportedStatus === "da quet" || cleanImportedStatus === "da quet ve");

                if (isImportedCheckedIn) {
                    status = "Checked In";
                    checkInTime = ImportedCheckInTime !== "" ? (isNaN(Date.parse(ImportedCheckInTime)) ? new Date().toISOString() : new Date(ImportedCheckInTime).toISOString()) : new Date().toISOString();
                    checkInLocation = ImportedCheckInLocation !== "" ? ImportedCheckInLocation : "Lối vào chính";
                    checkedBy = ImportedCheckedBy !== "" ? ImportedCheckedBy : "Nhân viên trực";
                }

                const newCust = {
                    id: ticketId,
                    HoVaTen: HoVaTen,
                    SoDienThoai: SoDienThoai,
                    Email: Email,
                    status: status,
                    qrCode: qrCode,
                    checkInTime: checkInTime,
                    checkInLocation: checkInLocation,
                    checkedBy: checkedBy
                };

                // Copy all other non-system columns as custom properties directly on customer
                state.currentImportHeaders.forEach(h => {
                    if (h !== nameCol && h !== phoneCol && h !== emailCol && h !== idCol) {
                        if (row[h] !== undefined && row[h] !== null) {
                            newCust[h] = String(row[h]).trim();
                        }
                    }
                });

                state.customers.push(newCust);
                tempImported.push(newCust);
                newCount++;

                if (status === "Checked In") {
                    const logRecord = {
                        id: "log-" + Date.now() + Math.random().toString(36).substr(2, 4),
                        customerId: ticketId,
                        customerName: HoVaTen,
                        checkInTime: checkInTime,
                        location: checkInLocation,
                        checkedBy: checkedBy
                    };
                    state.logs.push(logRecord);
                } else {
                    queueSimulatedEmail(newCust);
                }
            }
        });

        // Clear temp batch tracking attribute
        state.customers.forEach(c => {
            delete c._updatedThisBatch;
        });

        if (newCount > 0 || updateCount > 0) {
            saveState("customers");
            saveState("logs");
            saveState("emails");

            showToast("Nhập dữ liệu thành công", `Nhập mới ${newCount}, gộp ${updateCount} khách hàng.`, "success");
            playNotificationSound("success");
            logActivity("info", "Import dữ liệu Excel", `Admin đã nhập dữ liệu từ Excel (Thêm mới: ${newCount}, Gộp thông tin: ${updateCount}).`);
            
            // If sheets sync is active, upload new walk-ins/records in background
            if (state.settings.sheets && state.settings.sheets.enabled && state.settings.sheets.scriptUrl) {
                state.customers.forEach(cust => {
                    if (!cust._rowNum) {
                        postNewCustomerToGoogleSheets(cust);
                    }
                });
            }

            renderCustomersTable();
            renderDashboard();

            // Alert user with de-duplicated import statistics
            alert(`KẾT QUẢ NHẬP DỮ LIỆU EXCEL (ĐÃ LỌC TRÙNG):\n\n` +
                  `- Tổng số dòng dữ liệu đã xử lý: ${totalRowsProcessed} dòng.\n` +
                  `- Số khách hàng THÊM MỚI thành công: ${newCount} khách hàng.\n` +
                  `- Số khách hàng trùng lặp ĐÃ GỘP THÔNG TIN: ${updateCount} khách hàng.\n` +
                  `- Tổng số khách hàng hiện có trong hệ thống: ${state.customers.length} khách hàng.`);
        } else {
            showToast("Không nạp được dòng", "Vui lòng xem lại cấu trúc các cột hoặc tất cả dữ liệu đã bị trùng lặp.", "warning");
        }

        modalColumnMapping.classList.remove("active");
        state.currentImportRows = null;
        state.currentImportHeaders = null;
        excelFileInput.value = "";
    });

    function handleUploadFile(file) {
        const extension = file.name.split('.').pop().toLowerCase();

        if (!['xlsx', 'xls', 'csv'].includes(extension)) {
            showToast("Định dạng file không hỗ trợ", "Hệ thống chỉ nhận file .xlsx, .xls hoặc .csv.", "error");
            playNotificationSound("error");
            return;
        }

        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // Get first sheet
                const firstSheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[firstSheetName];

                // Convert JSON with header row 1
                const rows = XLSX.utils.sheet_to_json(sheet);

                if (rows.length === 0) {
                    showToast("File rỗng", "Không tìm thấy dòng dữ liệu nào trong bảng Excel.", "error");
                    return;
                }

                // Get headers from first row
                const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];
                if (!headers || headers.length === 0) {
                    showToast("Lỗi tiêu đề", "Không tìm thấy tiêu đề cột trong file.", "error");
                    return;
                }

                // Save temporary import state
                state.currentImportRows = rows;
                state.currentImportHeaders = headers;

                // Try to find best matches to auto-select mapping dropdowns
                const matchedName = findBestMatch(headers, namePossibles);
                const matchedPhone = findBestMatch(headers, phonePossibles);
                const matchedEmail = findBestMatch(headers, emailPossibles);
                const matchedId = findBestMatch(headers, idPossibles);

                // Populate selections
                mapNameSelect.innerHTML = `<option value="">-- Chọn cột chứa Họ Tên --</option>` +
                    headers.map(h => `<option value="${h}">${h}</option>`).join("");
                mapPhoneSelect.innerHTML = `<option value="">-- Chọn cột chứa SĐT (Tùy chọn) --</option>` +
                    headers.map(h => `<option value="${h}">${h}</option>`).join("");
                mapEmailSelect.innerHTML = `<option value="">-- Chọn cột chứa Email (Tùy chọn) --</option>` +
                    headers.map(h => `<option value="${h}">${h}</option>`).join("");
                mapIdSelect.innerHTML = `<option value="">-- Tự động sinh mã vé --</option>` +
                    headers.map(h => `<option value="${h}">${h}</option>`).join("");

                // Pre-select matches
                mapNameSelect.value = matchedName;
                mapPhoneSelect.value = matchedPhone;
                mapEmailSelect.value = matchedEmail;
                mapIdSelect.value = matchedId;

                // Show Mapping Modal
                modalColumnMapping.classList.add("active");
            } catch (err) {
                console.error("Excel parse error:", err);
                showToast("Lỗi phân tích file", "Không thể đọc dữ liệu file Excel. Kiểm tra định dạng.", "error");
            }
        };

        reader.readAsArrayBuffer(file);
        excelFileInput.value = "";
    }

    // Download mock template excel
    document.getElementById("btn-download-template").addEventListener("click", () => {
        try {
            const templateData = [
                { "HoVaTen": "Trương Minh Nhật", "SoDienThoai": "0911223344", "Email": "nhat.truong@example.com", "TruongTHPT": "THPT Chuyên Lê Hồng Phong", "ChungChiTiengAnh": "IELTS 7.5", "ChungChiTuyenSinhQuocTe": "SAT 1450", "TraiNghiemHoatDong": "Chủ nhiệm CLB Robot, Đạt giải Nhất khoa học kỹ thuật cấp Tỉnh" },
                { "HoVaTen": "Nguyễn Hoàng Mỹ", "SoDienThoai": "0988776655", "Email": "my.nguyen@example.com", "TruongTHPT": "THPT Chuyên Trần Đại Nghĩa", "ChungChiTiengAnh": "IELTS 8.0", "ChungChiTuyenSinhQuocTe": "ACT 34", "TraiNghiemHoatDong": "Thành viên Đội tuyển HSG Tiếng Anh, Tình nguyện viên Mùa hè xanh" },
                { "HoVaTen": "Trần Thanh Hằng", "SoDienThoai": "0909090909", "Email": "hang.tran@example.com", "TruongTHPT": "THPT Nguyễn Thượng Hiền", "ChungChiTiengAnh": "Không", "ChungChiTuyenSinhQuocTe": "Không", "TraiNghiemHoatDong": "Lớp trưởng 12A1, Huy chương Đồng điền kinh" }
            ];

            const ws = XLSX.utils.json_to_sheet(templateData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "DanhSachHocSinh");
            
            XLSX.writeFile(wb, "QR_Checkin_Mau_Import.xlsx");
            showToast("Tải mẫu Excel", "Đã tải file Excel mẫu thành công. Bạn hãy mở và thử nghiệm nhập.", "success");
        } catch (err) {
            console.error("Download template error:", err);
        }
    });

    // Helper to clean Vietnamese names for safe filenames
    function removeVietnameseTones(str) {
        str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g,"a"); 
        str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g,"e"); 
        str = str.replace(/ì|í|ị|ỉ|ĩ/g,"i"); 
        str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g,"o"); 
        str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g,"u"); 
        str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g,"y"); 
        str = str.replace(/đ/g,"d");
        str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g,"A");
        str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g,"E");
        str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g,"I");
        str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g,"O");
        str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g,"U");
        str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g,"Y");
        str = str.replace(/Đ/g,"D");
        // Replace non-alphanumeric chars with underscore
        str = str.replace(/[^a-zA-Z0-9\-_]/g, "_");
        // Collapse consecutive underscores
        str = str.replace(/_+/g, "_");
        return str;
    }

    // Helper to generate a single QR Code base64 image string
    function generateQRCodeDataURL(text) {
        return new Promise((resolve) => {
            const tempDiv = document.createElement("div");
            tempDiv.style.display = "none";
            document.body.appendChild(tempDiv);
            
            new QRCode(tempDiv, {
                text: text,
                width: 300,
                height: 300,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
            
            // Wait briefly for elements to be drawn
            setTimeout(() => {
                const canvas = tempDiv.querySelector("canvas");
                const img = tempDiv.querySelector("img");
                let dataUrl = "";
                if (img && img.src && img.src.startsWith("data:image")) {
                    dataUrl = img.src;
                } else if (canvas) {
                    dataUrl = canvas.toDataURL("image/png");
                }
                document.body.removeChild(tempDiv);
                resolve(dataUrl);
            }, 60);
        });
    }

    // Export customer list with QR codes for Mail Merge
    document.getElementById("btn-export-customers").addEventListener("click", () => {
        const query = customerSearch.value.toLowerCase();
        const type = filterType.value;
        const status = filterStatus.value;

        // Perform the filter matching Excel rows
        let filtered = state.customers.filter(cust => {
            const matchQuery = (cust.HoVaTen || "").toLowerCase().includes(query) || 
                               (cust.Email || "").toLowerCase().includes(query) || 
                               (cust.SoDienThoai || "").includes(query) || 
                               cust.id.toLowerCase().includes(query) ||
                               (cust.TruongTHPT || "").toLowerCase().includes(query);
                               
            let matchType = true;
            if (type !== "") {
                const english = (cust.ChungChiTiengAnh || "").trim().toLowerCase();
                const international = (cust.ChungChiTuyenSinhQuocTe || "").trim().toLowerCase();
                const hasEnglish = english !== "" && english !== "không" && english !== "none" && english !== "no" && english !== "n/a";
                const hasIntl = international !== "" && international !== "không" && international !== "none" && international !== "no" && international !== "n/a";
                
                if (type === "english") matchType = hasEnglish;
                else if (type === "international") matchType = hasIntl;
                else if (type === "both") matchType = hasEnglish && hasIntl;
                else if (type === "none") matchType = !hasEnglish && !hasIntl;
            }
            
            const matchStatus = status === "" || cust.status === status;

            return matchQuery && matchType && matchStatus;
        });

        if (filtered.length === 0) {
            showToast("Xuất danh sách lỗi", "Không có dữ liệu học sinh để xuất.", "warning");
            return;
        }

        try {
            // Build the row dataset professionally
            const exportRows = filtered.map((cust, index) => {
                const checkInTimeText = cust.checkInTime ? new Date(cust.checkInTime).toLocaleTimeString('vi-VN') + " " + new Date(cust.checkInTime).toLocaleDateString('vi-VN') : "Chưa check-in";
                const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(cust.qrCode)}`;
                const safeName = removeVietnameseTones(cust.HoVaTen);
                const qrFilename = `${cust.id}_${safeName}.png`;

                return {
                    "STT": index + 1,
                    "Mã Vé / ID": cust.id,
                    "Họ và Tên": cust.HoVaTen,
                    "Số Điện Thoại": cust.SoDienThoai || "",
                    "Email": cust.Email || "",
                    "Trường THPT": cust.TruongTHPT || "",
                    "Chứng chỉ Tiếng Anh": cust.ChungChiTiengAnh || "Không",
                    "Chứng chỉ Tuyển sinh QT": cust.ChungChiTuyenSinhQuocTe || "Không",
                    "Trải nghiệm Hoạt động": cust.TraiNghiemHoatDong || "Chưa có",
                    "Trạng Thái Check-in": cust.status === "Checked In" ? "Đã Check-in" : "Chờ Check-in",
                    "Thời Gian Check-in": checkInTimeText,
                    "Địa Điểm Check-in": cust.checkInLocation || "N/A",
                    "Nội Dung Mã QR": cust.qrCode,
                    "Đường Dẫn Ảnh QR (Dùng cho Mail Merge)": qrImageUrl,
                    "Tên File Ảnh QR (Trong file ZIP)": qrFilename
                };
            });

            const ws = XLSX.utils.json_to_sheet(exportRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "DanhSachHocSinh");
            
            // Format column widths nicely
            const colWidths = [
                { wch: 6 },  // STT
                { wch: 12 }, // Mã Vé
                { wch: 22 }, // Họ và Tên
                { wch: 15 }, // SĐT
                { wch: 24 }, // Email
                { wch: 25 }, // Trường THPT
                { wch: 18 }, // CC Tiếng Anh
                { wch: 20 }, // CC Tuyển sinh QT
                { wch: 30 }, // Trải nghiệm Hoạt động
                { wch: 18 }, // Trạng Thái
                { wch: 22 }, // Thời gian
                { wch: 18 }, // Địa điểm
                { wch: 22 }, // Nội dung QR
                { wch: 65 }, // Đường dẫn ảnh QR (rất dài)
                { wch: 30 }  // Tên file ảnh QR
            ];
            ws['!cols'] = colWidths;

            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Danh_Sach_Hoc_Sinh_QR_${dateStr}.xlsx`);
            
            showToast("Xuất Excel", `Đã xuất danh sách ${filtered.length} học sinh kèm mã QR thành công.`, "success");
            playNotificationSound("success");
            logActivity("info", "Xuất Excel Học Sinh", `Nhân viên đã xuất danh sách ${filtered.length} học sinh để làm Mail Merge.`);
        } catch (err) {
            console.error("Export Excel customers failed:", err);
            showToast("Xuất Excel thất bại", "Có lỗi xảy ra trong quá trình tạo file Excel.", "error");
        }
    });

    // ZIP QR Codes Download click event
    document.getElementById("btn-download-qr-zip").addEventListener("click", async () => {
        const query = customerSearch.value.toLowerCase();
        const type = filterType.value;
        const status = filterStatus.value;

        // Filter just like the table
        let filtered = state.customers.filter(cust => {
            const matchQuery = (cust.HoVaTen || "").toLowerCase().includes(query) || 
                               (cust.Email || "").toLowerCase().includes(query) || 
                               (cust.SoDienThoai || "").includes(query) || 
                               cust.id.toLowerCase().includes(query) ||
                               (cust.TruongTHPT || "").toLowerCase().includes(query);
                               
            let matchType = true;
            if (type !== "") {
                const english = (cust.ChungChiTiengAnh || "").trim().toLowerCase();
                const international = (cust.ChungChiTuyenSinhQuocTe || "").trim().toLowerCase();
                const hasEnglish = english !== "" && english !== "không" && english !== "none" && english !== "no" && english !== "n/a";
                const hasIntl = international !== "" && international !== "không" && international !== "none" && international !== "no" && international !== "n/a";
                
                if (type === "english") matchType = hasEnglish;
                else if (type === "international") matchType = hasIntl;
                else if (type === "both") matchType = hasEnglish && hasIntl;
                else if (type === "none") matchType = !hasEnglish && !hasIntl;
            }
            
            const matchStatus = status === "" || cust.status === status;

            return matchQuery && matchType && matchStatus;
        });

        if (filtered.length === 0) {
            showToast("Tải ZIP thất bại", "Không có học sinh nào trong danh sách để tạo mã QR.", "warning");
            return;
        }

        // Show a loading toast
        showToast("Đang tạo file ZIP", `Đang vẽ và nén mã QR cho ${filtered.length} học sinh, vui lòng đợi...`, "info");
        
        try {
            const zip = new JSZip();
            const folder = zip.folder("QR_Codes");

            // Process all in parallel
            const promises = filtered.map(async (cust) => {
                const dataUrl = await generateQRCodeDataURL(cust.qrCode);
                
                // Parse base64 to binary
                const base64Data = dataUrl.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
                const safeName = removeVietnameseTones(cust.HoVaTen);
                const fileName = `${cust.id}_${safeName}.png`;
                
                folder.file(fileName, base64Data, { base64: true });
            });

            await Promise.all(promises);

            // Generate zip file blob
            const content = await zip.generateAsync({ type: "blob" });
            
            // Download the zip file
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            const dateStr = new Date().toISOString().split('T')[0];
            link.download = `Ma_QR_Hoc_Sinh_${dateStr}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast("Tải ZIP thành công", `Đã tải về file ZIP chứa ${filtered.length} ảnh mã QR.`, "success");
            playNotificationSound("success");
            logActivity("info", "Tải ZIP mã QR", `Nhân viên đã tải về file ZIP chứa mã QR của ${filtered.length} học sinh.`);
        } catch (err) {
            console.error("Zipping QR codes failed:", err);
            showToast("Lỗi nén ZIP", "Không thể nén và tạo tệp ZIP chứa ảnh mã QR.", "error");
        }
    });

    // Delete all customers (Admin-only safety action)
    document.getElementById("btn-clear-customers").addEventListener("click", () => {
        if (confirm("CẢNH BÁO NGUY HIỂM: Bạn có chắc chắn muốn xóa TOÀN BỘ danh sách khách hàng và lịch sử check-in không? Thao tác này không thể khôi phục!")) {
            state.customers = [];
            state.logs = [];
            state.emails = [];
            
            saveState("customers");
            saveState("logs");
            saveState("emails");

            showToast("Hệ thống đặt lại", "Đã dọn dẹp sạch sẽ cơ sở dữ liệu khách hàng.", "error");
            logActivity("broadcast", "Hệ thống Reset", "Admin đã xóa toàn bộ khách hàng và cơ sở dữ liệu check-in.");
            renderCustomersTable();
        }
    });

    // Send QRs to all pending customers
    document.getElementById("btn-send-all-qrs").addEventListener("click", () => {
        const pendingEmails = state.customers.filter(c => c.status === "Pending");
        
        if (pendingEmails.length === 0) {
            showToast("Gửi email", "Không tìm thấy khách hàng nào ở trạng thái chờ vé.", "warning");
            return;
        }

        if (confirm(`Hệ thống sẽ gửi email chứa vé QR cho ${pendingEmails.length} khách hàng chưa check-in. Xác nhận tiếp tục?`)) {
            let count = 0;
            pendingEmails.forEach(c => {
                queueSimulatedEmail(c, false);
                count++;
            });
            showToast("Bắt đầu gửi", `Đang chuẩn bị gửi ${count} email vé QR tới hàng đợi.`, "success");
            playNotificationSound("success");
        }
    });

    // ----------------------------------------------------------------------
    // XIV. EMAIL SANDBOX & EMAILJS SENDER
    // ----------------------------------------------------------------------
    const emailOutboxTableBody = document.getElementById("email-outbox-table-body");
    const outboxCountBadge = document.getElementById("email-outbox-count");

    function renderEmailOutbox() {
        // Summary Counts
        document.getElementById("email-sum-processed").textContent = state.emails.length;
        document.getElementById("email-sum-pending").textContent = state.emails.filter(e => e.status === "Pending").length;
        const sentSuccessCount = state.emails.filter(e => e.status === "Sent" || e.status === "Sent (Real)").length;
        document.getElementById("email-sum-success").textContent = sentSuccessCount;
        
        outboxCountBadge.textContent = state.emails.length;

        if (state.emails.length === 0) {
            emailOutboxTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted">Hộp thư đi trống. Các email sinh vé QR sẽ được ghi nhận tại đây.</td>
                </tr>
            `;
            return;
        }

        emailOutboxTableBody.innerHTML = [...state.emails].reverse().map(email => {
            const timeString = new Date(email.createdAt).toLocaleTimeString('vi-VN') + " " + new Date(email.createdAt).toLocaleDateString('vi-VN');
            let statusBadge = `<span class="badge-status bg-amber">Chờ gửi</span>`;
            if (email.status === "Sent") {
                statusBadge = `<span class="badge-status badge-success">Mô phỏng Đã Gửi</span>`;
            } else if (email.status === "Sent (Real)") {
                statusBadge = `<span class="badge-status bg-indigo">Đã Gửi Thật (EmailJS)</span>`;
            } else if (email.status === "Failed") {
                statusBadge = `<span class="badge-status bg-crimson">Lỗi</span>`;
            }

            const canSend = email.status === "Pending" || email.status === "Failed";
            const sendBtn = canSend ? `
                <button class="btn btn-primary btn-sm btn-send-single-email" data-id="${email.id}" style="margin-right: 5px;">
                    <i class="ri-mail-send-line"></i> Gửi Thư
                </button>
            ` : '';

            return `
                <tr>
                    <td>${timeString}</td>
                    <td><strong>${email.customerName}</strong></td>
                    <td><code>${email.customerEmail}</code></td>
                    <td>${email.subject}</td>
                    <td>${statusBadge}</td>
                    <td class="text-right">
                        ${sendBtn}
                        <button class="btn btn-secondary btn-sm btn-preview-email" data-id="${email.id}">
                            <i class="ri-mail-open-line"></i> Xem HTML Email
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

        // Bind send single email buttons
        document.querySelectorAll(".btn-send-single-email").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const email = state.emails.find(e => e.id === id);
                if (email) {
                    const cust = state.customers.find(c => c.id === email.customerId);
                    if (cust) {
                        sendEmailAsync(email, cust);
                    } else {
                        showToast("Lỗi", "Không tìm thấy thông tin học sinh.", "error");
                    }
                }
            });
        });

        // Bind preview HTML buttons
        document.querySelectorAll(".btn-preview-email").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const email = state.emails.find(e => e.id === id);
                if (email) openEmailPreviewModal(email);
            });
        });
    }

    function queueSimulatedEmail(cust, forceResend = false) {
        // Skip duplicate check unless forced
        if (!forceResend) {
            const duplicate = state.emails.some(e => e.customerId === cust.id);
            if (duplicate) return;
        }

        const emailRecord = {
            id: "email-" + Date.now() + Math.random().toString(36).substr(2, 4),
            customerId: cust.id,
            customerName: cust.HoVaTen,
            customerEmail: cust.Email,
            subject: `[Xác Nhận Đăng Ký] Thẻ QR Tuyển Sinh THPT - ${cust.HoVaTen}`,
            status: "Pending",
            createdAt: new Date().toISOString()
        };

        state.emails.push(emailRecord);
        saveState("emails");
        outboxCountBadge.textContent = state.emails.length;

        // Newly created emails only queued in Pending status, no automatic sending as requested!
        if (state.currentView === "emails") renderEmailOutbox();
    }

    function sendEmailAsync(emailRecord, cust) {
        // Check if real email sender EmailJS is configured and enabled
        if (state.settings.emailjs.enabled && state.settings.emailjs.serviceId && state.settings.emailjs.templateId && state.settings.emailjs.publicKey) {
            emailjs.init({
                publicKey: state.settings.emailjs.publicKey,
            });

            // For EmailJS we generate a Google Charts API QR code URL so it appears as a clean image in their actual email inbox!
            const qrImageUrl = `https://chart.googleapis.com/chart?cht=qr&chs=250x250&chl=${encodeURIComponent(cust.qrCode)}`;
            
            const templateParams = {
                name: cust.HoVaTen,
                email: cust.Email,
                ticket_id: cust.id,
                qr_code_url: qrImageUrl,
                school: cust.TruongTHPT || "",
                phone: cust.SoDienThoai || "",
                english_cert: cust.ChungChiTiengAnh || "Không",
                admission_cert: cust.ChungChiTuyenSinhQuocTe || "Không",
                activity_exp: cust.TraiNghiemHoatDong || "Không"
            };

            emailjs.send(state.settings.emailjs.serviceId, state.settings.emailjs.templateId, templateParams)
                .then(() => {
                    emailRecord.status = "Sent (Real)";
                    saveState("emails");
                    if (state.currentView === "emails") renderEmailOutbox();
                    showToast("Đã gửi email thật", `Thẻ QR đã được gửi đến inbox: ${cust.Email}`, "success");
                })
                .catch((err) => {
                    console.error("EmailJS sending failed:", err);
                    emailRecord.status = "Failed";
                    saveState("emails");
                    if (state.currentView === "emails") renderEmailOutbox();
                    showToast("Lỗi gửi EmailJS", `Không thể gửi tới ${cust.Email}. Chuyển về mô phỏng.`, "error");
                });
        } else {
            // MOCK SEND SUCCESS
            emailRecord.status = "Sent";
            saveState("emails");
            if (state.currentView === "emails") renderEmailOutbox();
            showToast("Đã gửi email (Mô phỏng)", `Gửi thư cho "${cust.HoVaTen}" thành công (Outbox Sandbox)`, "info");
        }
    }

    // Modal Email Preview
    const modalEmail = document.getElementById("modal-email-preview");
    
    function openEmailPreviewModal(email) {
        const cust = state.customers.find(c => c.id === email.customerId) || {};
        
        document.getElementById("email-mock-to").innerHTML = `<strong>Người nhận:</strong> ${cust.HoVaTen} &lt;${email.customerEmail}&gt;`;
        document.getElementById("email-mock-sub").innerHTML = `<strong>Tiêu đề:</strong> ${email.subject}`;

        const passBadgeClass = "background:#6366f1; color:white;";

        // We render a beautiful inline HTML newsletter ticket representation in the device preview
        const container = document.getElementById("email-content-rendered-inside");
        
        container.innerHTML = `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); color: #333333; line-height: 1.6;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #4f46e5, #818cf8); padding: 35px 20px; text-align: center; color: #ffffff;">
                    <h2 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px;">XÁC NHẬN HỒ SƠ TUYỂN SINH THÀNH CÔNG</h2>
                    <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">Kỳ Tuyển Sinh THPT & Xét Tuyển Học Bạ Quốc Tế 2026</p>
                </div>
                
                <!-- Body Content -->
                <div style="padding: 30px 25px;">
                    <p style="margin-top: 0; font-size: 15px;">Kính gửi em <strong>${cust.HoVaTen || 'Quý học sinh'}</strong>,</p>
                    <p style="font-size: 14px; color: #555555;">Ban tuyển sinh xin chân thành cảm ơn em đã hoàn tất đăng ký thông tin xét tuyển. Dưới đây là thẻ điện tử xác nhận chính thức của em. Vui lòng **lưu lại mã QR này** và xuất trình tại cổng đón tiếp vào ngày làm việc để làm thủ tục check-in nhanh chóng.</p>
                    
                    <!-- Student Academic Profile Box -->
                    <div style="text-align: left; font-size: 13px; color: #4b5563; margin: 20px 0; padding: 15px; background: #f3f4f6; border-radius: 8px; border: 1px solid #e5e7eb;">
                        <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #1f2937;">THÔNG TIN HỒ SƠ CỦA HỌC SINH:</h4>
                        <p style="margin: 3px 0;">🏫 <strong>Trường THPT:</strong> ${cust.TruongTHPT || 'N/A'}</p>
                        <p style="margin: 3px 0;">📞 <strong>Số Điện Thoại:</strong> ${cust.SoDienThoai || 'N/A'}</p>
                        <p style="margin: 3px 0;">🇬🇧 <strong>Chứng chỉ Tiếng Anh:</strong> ${cust.ChungChiTiengAnh || 'Không'}</p>
                        <p style="margin: 3px 0;">🌎 <strong>Chứng chỉ Tuyển sinh QT:</strong> ${cust.ChungChiTuyenSinhQuocTe || 'Không'}</p>
                        <p style="margin: 3px 0;">🏆 <strong>Trải nghiệm Hoạt động:</strong> ${cust.TraiNghiemHoatDong || 'N/A'}</p>
                    </div>

                    <!-- Ticket Layout Box -->
                    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 25px; margin: 25px 0; text-align: center;">
                        <h3 style="margin-top: 0; font-size: 18px; color: #111827;">MÃ QR CHECK-IN NHẬP HỌC</h3>
                        <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; ${passBadgeClass} text-transform: uppercase;">
                            ${cust.TruongTHPT || 'Học sinh'}
                        </span>
                        
                        <!-- QR Image rendered inside Email Mockup -->
                        <div style="margin: 20px auto; background: #ffffff; padding: 12px; border-radius: 6px; width: 150px; height: 150px; display: flex; align-items: center; justify-content: center; border: 1px solid #e5e7eb; box-shadow: 0 2px 4px rgba(0,0,0,0.02);" id="email-preview-qr-renderer">
                            <!-- Injected by QRCodeJS -->
                        </div>

                        <!-- Barcode rendered inside Email Mockup -->
                        <div style="margin: 15px auto; background: #ffffff; padding: 10px; border-radius: 6px; width: 280px; height: 75px; display: flex; align-items: center; justify-content: center; border: 1px solid #e5e7eb; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                            <svg id="email-preview-barcode-renderer"></svg>
                        </div>
                        
                        <div style="display: flex; justify-content: space-around; border-top: 1px dashed #e5e7eb; padding-top: 15px; text-align: left; font-size: 12px;">
                            <div>
                                <span style="display: block; color: #9ca3af; font-size: 10px; font-weight: 600;">MÃ SỐ VÉ / ID</span>
                                <strong style="color: #111827;">${cust.id}</strong>
                            </div>
                            <div>
                                <span style="display: block; color: #9ca3af; font-size: 10px; font-weight: 600;">TÌNH TRẠNG HỒ SƠ</span>
                                <strong style="color: #d97706;">CHỜ QUÉT MÃ</strong>
                            </div>
                        </div>
                    </div>

                    <!-- Event Details -->
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px; font-size: 13px; color: #166534;">
                        <p style="margin: 0 0 5px 0;">📅 <strong>Thời gian phỏng vấn:</strong> Thứ Hai | Ngày 22/06/2026 | 08:00 - 17:00</p>
                        <p style="margin: 0;">📍 <strong>Địa điểm đón tiếp:</strong> Văn Phòng Tuyển Sinh - Đại Học Quốc Gia (Hà Nội)</p>
                    </div>

                    <p style="font-size: 13px; color: #6b7280; margin-top: 25px; text-align: center;">Đây là email tự động từ hệ thống Quản lý Tuyển sinh, vui lòng không phản hồi thư này.</p>
                </div>

                <!-- Footer -->
                <div style="background: #f3f4f6; padding: 20px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0;">© 2026 Ban Tuyển Sinh Đại Học Quốc Gia. Mọi quyền được bảo lưu.</p>
                </div>
            </div>
        `;

        // Generates the QR Code and Barcode element in the newsletter mockup dynamically
        setTimeout(() => {
            const qrTarget = document.getElementById("email-preview-qr-renderer");
            if (qrTarget) {
                qrTarget.innerHTML = "";
                new QRCode(qrTarget, {
                    text: cust.qrCode,
                    width: 126,
                    height: 126,
                    colorDark: "#111827",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            }

            const barcodeTarget = document.getElementById("email-preview-barcode-renderer");
            if (barcodeTarget) {
                try {
                    const idLength = String(cust.id).length;
                    const barcodeWidth = idLength > 12 ? 1.0 : (idLength > 9 ? 1.2 : 1.5);
                    JsBarcode(barcodeTarget, cust.id, {
                        format: "CODE39",
                        width: barcodeWidth,
                        height: 45,
                        displayValue: true,
                        fontSize: 10,
                        textMargin: 2,
                        margin: 10,
                        background: "#ffffff",
                        lineColor: "#111827"
                    });
                } catch (bErr) {
                    console.error("Email preview barcode error:", bErr);
                }
            }
        }, 100);

        modalEmail.classList.add("active");
    }

    function closeEmailPreviewModal() {
        modalEmail.classList.remove("active");
    }

    document.getElementById("btn-close-email-preview").addEventListener("click", closeEmailPreviewModal);

    // Send all pending emails
    document.getElementById("btn-send-pending-emails").addEventListener("click", () => {
        const pending = state.emails.filter(e => e.status === "Pending" || e.status === "Failed");
        if (pending.length === 0) {
            showToast("Gửi thư", "Không có thư nào ở trạng thái chờ gửi hoặc gửi lỗi.", "warning");
            return;
        }

        if (confirm(`Bạn có chắc chắn muốn gửi ${pending.length} thư đang chờ trong outbox không?`)) {
            showToast("Bắt đầu gửi", `Đang gửi hàng loạt ${pending.length} thư...`, "info");
            
            // Process them sequentially with a slight delay so we don't hit rate limits
            let index = 0;
            const sendNext = () => {
                if (index < pending.length) {
                    const email = pending[index];
                    const cust = state.customers.find(c => c.id === email.customerId);
                    if (cust) {
                        sendEmailAsync(email, cust);
                    }
                    index++;
                    setTimeout(sendNext, 200);
                } else {
                    showToast("Hoàn tất gửi", `Đã xử lý xong hàng đợi gửi thư.`, "success");
                }
            };
            sendNext();
        }
    });

    // Delete email histories
    document.getElementById("btn-clear-emails").addEventListener("click", () => {
        if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử thư đi?")) {
            state.emails = [];
            saveState("emails");
            renderEmailOutbox();
            showToast("Đã dọn dẹp", "Đã xóa toàn bộ bản ghi email trong Sandbox.", "info");
        }
    });

    // ----------------------------------------------------------------------
    // XV. HISTORY LOGS & EXPORT (EXCEL/CSV REPORTING)
    // ----------------------------------------------------------------------
    const historyTableBody = document.getElementById("history-table-body");
    const hSearch = document.getElementById("history-search-input");
    const hFilterLocation = document.getElementById("history-filter-location");
    const hFilterUser = document.getElementById("history-filter-user");
    const hFilterDate = document.getElementById("history-filter-date");

    function populateHistoryFilters() {
        // Populate Location select already handled in populateLocationDropdowns()
        
        // Populate Staff/User filters
        const uniqueStaff = [...new Set(state.logs.map(l => l.checkedBy))];
        const staffEl = document.getElementById("history-filter-user");
        if (staffEl) {
            staffEl.innerHTML = `<option value="">Tất cả nhân viên</option>` + uniqueStaff.map(st => `<option value="${st}">${st}</option>`).join("");
        }
    }

    function renderHistoryTable() {
        const query = hSearch.value.toLowerCase();
        const loc = hFilterLocation.value;
        const staff = hFilterUser.value;
        const dateVal = hFilterDate.value;

        let filtered = state.logs.filter(log => {
            const cust = state.customers.find(c => c.id === log.customerId) || {};
            
            const matchQuery = log.customerName.toLowerCase().includes(query) || 
                               log.customerId.toLowerCase().includes(query) ||
                               (cust.Email && cust.Email.toLowerCase().includes(query)) ||
                               (cust.SoDienThoai && cust.SoDienThoai.includes(query)) ||
                               (cust.TruongTHPT && cust.TruongTHPT.toLowerCase().includes(query));
                               
            const matchLoc = loc === "" || log.location === loc;
            const matchStaff = staff === "" || log.checkedBy === staff;
            
            let matchDate = true;
            if (dateVal !== "") {
                const logDate = new Date(log.checkInTime).toISOString().split('T')[0];
                matchDate = logDate === dateVal;
            }

            return matchQuery && matchLoc && matchStaff && matchDate;
        });

        // Update count badge
        document.getElementById("history-logs-count").textContent = `${filtered.length} bản ghi`;

        if (filtered.length === 0) {
            historyTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted">Không tìm thấy bản ghi check-in nào khớp bộ lọc.</td>
                </tr>
            `;
            return;
        }

        historyTableBody.innerHTML = [...filtered].reverse().map(log => {
            const cust = state.customers.find(c => c.id === log.customerId) || {};
            const cleanTime = new Date(log.checkInTime).toLocaleTimeString('vi-VN') + " - " + new Date(log.checkInTime).toLocaleDateString('vi-VN');

            return `
                <tr>
                    <td><strong>${cleanTime}</strong></td>
                    <td><code>${log.customerId}</code></td>
                    <td><strong>${log.customerName}</strong></td>
                    <td>${cust.TruongTHPT || 'N/A'}</td>
                    <td>${cust.ChungChiTiengAnh || 'Không'}</td>
                    <td><i class="ri-map-pin-line text-muted"></i> ${log.location}</td>
                    <td>${log.checkedBy}</td>
                </tr>
            `;
        }).join("");
    }

    // Attach history listeners
    hSearch.addEventListener("input", renderHistoryTable);
    hFilterLocation.addEventListener("change", renderHistoryTable);
    hFilterUser.addEventListener("change", renderHistoryTable);
    hFilterDate.addEventListener("change", renderHistoryTable);

    document.getElementById("btn-reset-history-filters").addEventListener("click", () => {
        hSearch.value = "";
        hFilterLocation.value = "";
        hFilterUser.value = "";
        hFilterDate.value = "";
        renderHistoryTable();
        showToast("Reset bộ lọc", "Đã trả các bộ lọc lịch sử check-in về mặc định.", "info");
    });

    // Excel export for Check-in history
    document.getElementById("btn-export-history").addEventListener("click", () => {
        const query = hSearch.value.toLowerCase();
        const loc = hFilterLocation.value;
        const staff = hFilterUser.value;
        const dateVal = hFilterDate.value;

        // Perform the filter matching Excel rows
        let filteredLogs = state.logs.filter(log => {
            const cust = state.customers.find(c => c.id === log.customerId) || {};
            
            const matchQuery = log.customerName.toLowerCase().includes(query) || 
                               log.customerId.toLowerCase().includes(query) ||
                               (cust.email && cust.email.toLowerCase().includes(query));
                               
            const matchLoc = loc === "" || log.location === loc;
            const matchStaff = staff === "" || log.checkedBy === staff;
            
            let matchDate = true;
            if (dateVal !== "") {
                const logDate = new Date(log.checkInTime).toISOString().split('T')[0];
                matchDate = logDate === dateVal;
            }

            return matchQuery && matchLoc && matchStaff && matchDate;
        });

        if (filteredLogs.length === 0) {
            showToast("Xuất báo cáo lỗi", "Không có dữ liệu check-in để xuất báo cáo.", "warning");
            return;
        }

        try {
            // Build the row dataset professionally
            const exportRows = filteredLogs.map((log, index) => {
                const cust = state.customers.find(c => c.id === log.customerId) || {};
                const dateObj = new Date(log.checkInTime);
                
                return {
                    "STT": index + 1,
                    "Thời gian check-in": dateObj.toLocaleTimeString('vi-VN') + " " + dateObj.toLocaleDateString('vi-VN'),
                    "Mã Vé": log.customerId,
                    "Họ và Tên": log.customerName,
                    "Số Điện Thoại": cust.SoDienThoai || "",
                    "Email": cust.Email || "",
                    "Trường THPT": cust.TruongTHPT || "",
                    "Chứng chỉ Tiếng Anh": cust.ChungChiTiengAnh || "Không",
                    "Chứng chỉ Tuyển sinh QT": cust.ChungChiTuyenSinhQuocTe || "Không",
                    "Trải nghiệm Hoạt động": cust.TraiNghiemHoatDong || "Chưa có",
                    "Địa Điểm Soát Vé": log.location,
                    "Nhân Viên Check-in": log.checkedBy
                };
            });

            const ws = XLSX.utils.json_to_sheet(exportRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "BaoCaoCheckIn");
            
            // Format column widths nicely
            const colWidths = [
                { wch: 6 },  // STT
                { wch: 22 }, // Thời gian
                { wch: 10 }, // Mã Vé
                { wch: 22 }, // Họ và Tên
                { wch: 15 }, // SĐT
                { wch: 24 }, // Email
                { wch: 25 }, // Trường THPT
                { wch: 18 }, // CC Tiếng Anh
                { wch: 20 }, // CC Tuyển sinh QT
                { wch: 30 }, // Trải nghiệm Hoạt động
                { wch: 18 }, // Địa điểm
                { wch: 20 }  // Nhân viên
            ];
            ws['!cols'] = colWidths;

            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Bao_Cao_CheckIn_Su_Kien_${dateStr}.xlsx`);
            
            showToast("Xuất Excel", `Đã tải báo cáo với ${filteredLogs.length} dòng check-in thành công.`, "success");
            playNotificationSound("success");
        } catch (err) {
            console.error("Export Excel history failed:", err);
            showToast("Lỗi xuất Excel", "Không thể tạo file báo cáo. Hãy thử lại.", "error");
        }
    });

    // ----------------------------------------------------------------------
    // XVI. USERS ACCOUNTS MANAGEMENT & ROLES
    // ----------------------------------------------------------------------
    const usersTableBody = document.getElementById("users-table-body");
    const userForm = document.getElementById("user-manage-form");
    const userFormTitle = document.getElementById("user-form-title");

    function renderUsersTable() {
        usersTableBody.innerHTML = state.users.map(u => {
            const isSelf = state.currentUser && state.currentUser.id === u.id;
            let roleBadge = `<span class="user-role-badge badge-user">User</span>`;
            if (u.role === "admin") roleBadge = `<span class="user-role-badge badge-admin">Admin</span>`;
            if (u.role === "manager") roleBadge = `<span class="user-role-badge badge-manager">Manager</span>`;

            return `
                <tr>
                    <td><strong>${u.name}</strong> ${isSelf ? '<span class="text-muted font-12">(Bạn)</span>' : ''}</td>
                    <td><code>${u.email}</code></td>
                    <td>${u.department || 'N/A'}</td>
                    <td>${roleBadge}</td>
                    <td class="text-right">
                        ${isSelf ? '<span class="text-muted font-12">Không thể tự sửa</span>' : `
                            <div class="justify-end gap-10">
                                <button class="btn-icon btn-secondary btn-sm btn-edit-user" data-id="${u.id}">
                                    <i class="ri-edit-line"></i>
                                </button>
                                <button class="btn-icon btn-secondary btn-sm text-danger btn-delete-user" data-id="${u.id}">
                                    <i class="ri-delete-bin-line"></i>
                                </button>
                            </div>
                        `}
                    </td>
                </tr>
            `;
        }).join("");

        // Bind user clicks
        bindUserActions();
    }

    function bindUserActions() {
        document.querySelectorAll(".btn-edit-user").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const u = state.users.find(usr => usr.id === id);
                if (u) {
                    userFormTitle.textContent = `Sửa Tài Khoản: ${u.name}`;
                    document.getElementById("manage-user-id").value = u.id;
                    document.getElementById("manage-user-name").value = u.name;
                    document.getElementById("manage-user-email").value = u.email;
                    document.getElementById("manage-user-password").value = u.password;
                    document.getElementById("manage-user-dept").value = u.department || "";
                    document.getElementById("manage-user-role").value = u.role;
                    
                    document.getElementById("btn-cancel-edit-user").classList.remove("hide");
                    document.getElementById("btn-save-user").textContent = "Cập nhật Quyền";
                }
            });
        });

        document.querySelectorAll(".btn-delete-user").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const idx = state.users.findIndex(usr => usr.id === id);
                if (idx !== -1) {
                    if (confirm(`Bạn có chắc chắn muốn xóa tài khoản nhân viên "${state.users[idx].name}"?`)) {
                        const name = state.users[idx].name;
                        state.users.splice(idx, 1);
                        saveState("users");
                        
                        showToast("Đã xóa", `Đã xóa tài khoản "${name}" thành công.`, "info");
                        renderUsersTable();
                    }
                }
            });
        });
    }

    document.getElementById("btn-cancel-edit-user").addEventListener("click", () => {
        resetUserForm();
    });

    function resetUserForm() {
        userForm.reset();
        document.getElementById("manage-user-id").value = "";
        userFormTitle.textContent = "Tạo Tài Khoản Nhân Viên Mới";
        document.getElementById("btn-cancel-edit-user").classList.add("hide");
        document.getElementById("btn-save-user").textContent = "Tạo Tài Khoản";
    }

    userForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const id = document.getElementById("manage-user-id").value;
        const name = document.getElementById("manage-user-name").value.trim();
        const email = document.getElementById("manage-user-email").value.trim();
        const password = document.getElementById("manage-user-password").value;
        const department = document.getElementById("manage-user-dept").value.trim();
        const role = document.getElementById("manage-user-role").value;

        if (id === "") {
            // Create user
            const duplicate = state.users.some(u => u.email.toLowerCase() === email.toLowerCase());
            if (duplicate) {
                showToast("Lỗi tạo user", "Email này đã tồn tại trong hệ thống.", "error");
                return;
            }

            const newUser = {
                id: "usr-" + Date.now(),
                name,
                email,
                password,
                department,
                role
            };

            state.users.push(newUser);
            saveState("users");
            showToast("Thành công", `Đã tạo tài khoản nhân viên "${name}" quyền ${role}.`, "success");
            logActivity("info", "Đăng ký nhân viên", `Admin đã tạo tài khoản nhân viên mới: ${name} (${email})`);
        } else {
            // Edit user
            const u = state.users.find(usr => usr.id === id);
            if (u) {
                u.name = name;
                u.email = email;
                u.password = password;
                u.department = department;
                u.role = role;

                saveState("users");
                showToast("Thành công", `Cập nhật tài khoản "${name}" hoàn tất.`, "success");
                logActivity("info", "Thay đổi quyền user", `Admin đã thay đổi quyền tài khoản nhân viên: ${name}`);
            }
        }

        resetUserForm();
        renderUsersTable();
    });

    // ----------------------------------------------------------------------
    // XVII. GENERAL SETTINGS INTERACTION
    // ----------------------------------------------------------------------
    const generalForm = document.getElementById("settings-general-form");
    const emailjsForm = document.getElementById("settings-emailjs-form");

    function renderSettings() {
        document.getElementById("settings-sound-enabled").checked = state.settings.soundEnabled;
        document.getElementById("settings-sound-volume").value = state.settings.soundVolume;
        document.getElementById("val-sound-volume").textContent = `${state.settings.soundVolume}%`;
        
        document.getElementById("settings-browser-notification-enabled").checked = state.settings.browserNotifications;

        // EmailJS input mappings
        document.getElementById("emailjs-enabled").checked = state.settings.emailjs.enabled;
        document.getElementById("emailjs-service-id").value = state.settings.emailjs.serviceId || "";
        document.getElementById("emailjs-template-id").value = state.settings.emailjs.templateId || "";
        document.getElementById("emailjs-public-key").value = state.settings.emailjs.publicKey || "";

        // Google Sheets input mappings
        if (document.getElementById("sheets-sync-enabled")) {
            document.getElementById("sheets-sync-enabled").checked = state.settings.sheets ? state.settings.sheets.enabled : false;
        }
        if (document.getElementById("sheets-script-url")) {
            document.getElementById("sheets-script-url").value = (state.settings.sheets && state.settings.sheets.scriptUrl) ? state.settings.sheets.scriptUrl : "";
        }

        renderSettingsLocationsList();
    }

    function renderSettingsLocationsList() {
        const badgesContainer = document.getElementById("settings-locations-badges");
        badgesContainer.innerHTML = state.settings.locations.map((loc, idx) => {
            return `
                <span class="location-badge">
                    ${loc}
                    <button type="button" class="btn-delete-badge" data-index="${idx}" title="Xóa địa điểm">×</button>
                </span>
            `;
        }).join("");

        // Bind deletes
        badgesContainer.querySelectorAll(".btn-delete-badge").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.getAttribute("data-index"));
                if (state.settings.locations.length <= 1) {
                    showToast("Cảnh báo", "Hệ thống cần tối thiểu 1 địa điểm check-in để hoạt động.", "warning");
                    return;
                }
                const removedLoc = state.settings.locations[idx];
                state.settings.locations.splice(idx, 1);
                saveState("settings");
                
                showToast("Đã xóa", `Đã xóa địa điểm "${removedLoc}"`, "info");
                renderSettingsLocationsList();
                populateLocationDropdowns();
            });
        });
    }

    // Add new location setting trigger
    document.getElementById("btn-add-location").addEventListener("click", () => {
        const input = document.getElementById("new-location-input");
        const val = input.value.trim();
        if (val) {
            if (state.settings.locations.includes(val)) {
                showToast("Lỗi trùng", "Địa điểm này đã tồn tại trong cấu hình.", "error");
                return;
            }
            state.settings.locations.push(val);
            saveState("settings");
            input.value = "";
            showToast("Thành công", `Đã thêm địa điểm "${val}"`, "success");
            renderSettingsLocationsList();
            populateLocationDropdowns();
            playNotificationSound("success");
        }
    });

    // Sound ranges interactively updating volume label
    document.getElementById("settings-sound-volume").addEventListener("input", (e) => {
        document.getElementById("val-sound-volume").textContent = `${e.target.value}%`;
    });

    // Save General Settings
    generalForm.addEventListener("submit", (e) => {
        e.preventDefault();
        state.settings.soundEnabled = document.getElementById("settings-sound-enabled").checked;
        state.settings.soundVolume = parseInt(document.getElementById("settings-sound-volume").value);
        state.settings.browserNotifications = document.getElementById("settings-browser-notification-enabled").checked;

        saveState("settings");
        showToast("Cấu hình lưu", "Đã lưu cài đặt chung ứng dụng thành công.", "success");
        playNotificationSound("success");
    });

    // Save EmailJS settings
    emailjsForm.addEventListener("submit", (e) => {
        e.preventDefault();
        state.settings.emailjs.enabled = document.getElementById("emailjs-enabled").checked;
        state.settings.emailjs.serviceId = document.getElementById("emailjs-service-id").value.trim();
        state.settings.emailjs.templateId = document.getElementById("emailjs-template-id").value.trim();
        state.settings.emailjs.publicKey = document.getElementById("emailjs-public-key").value.trim();

        saveState("settings");
        showToast("Cấu hình lưu", "Cài đặt tích hợp EmailJS đã được cập nhật.", "success");
        playNotificationSound("success");
    });

    // ----------------------------------------------------------------------
    // XVIII. LIGHT & DARK THEME TOGGLE
    // ----------------------------------------------------------------------
    const themeBtn = document.getElementById("btn-theme-toggle");

    themeBtn.addEventListener("click", () => {
        const targetTheme = state.currentTheme === "dark" ? "light" : "dark";
        state.currentTheme = targetTheme;
        
        document.documentElement.setAttribute("data-theme", targetTheme);
        localStorage.setItem("qr_theme", targetTheme);
        updateThemeToggleButtonIcon();

        showToast("Giao diện thay đổi", `Đã chuyển sang giao diện ${targetTheme === 'dark' ? 'Tối (Dark)' : 'Sáng (Light)'}.`, "info");
    });

    function updateThemeToggleButtonIcon() {
        const icon = themeBtn.querySelector("i");
        if (state.currentTheme === "dark") {
            icon.className = "ri-sun-line";
        } else {
            icon.className = "ri-moon-line";
        }
    }

    // ----------------------------------------------------------------------
    // XIX. COLD BOOT APPLICATION INITIALIZATION
    // ----------------------------------------------------------------------
    async function pullLatestDataFromServer() {
        if (!isServerSyncEnabled) return;
        try {
            const response = await fetch("/api/data");
            if (response.ok) {
                const contentType = response.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    return;
                }
                const data = await response.json();
                let changed = false;

                const hasChanged = (oldVal, newVal) => {
                    return JSON.stringify(oldVal) !== JSON.stringify(newVal);
                };

                // Sync customers
                if (data.customers && hasChanged(state.customers, data.customers)) {
                    state.customers = data.customers;
                    localStorage.setItem("qr_customers", JSON.stringify(data.customers));
                    changed = true;
                }
                // Sync logs
                if (data.logs && hasChanged(state.logs, data.logs)) {
                    state.logs = data.logs;
                    localStorage.setItem("qr_checkin_logs", JSON.stringify(data.logs));
                    changed = true;
                }
                // Sync emails
                if (data.emails && hasChanged(state.emails, data.emails)) {
                    state.emails = data.emails;
                    localStorage.setItem("qr_emails", JSON.stringify(data.emails));
                    changed = true;
                }
                // Sync activityFeed
                if (data.activityFeed && hasChanged(state.activityFeed, data.activityFeed)) {
                    state.activityFeed = data.activityFeed;
                    localStorage.setItem("qr_activity_feed", JSON.stringify(data.activityFeed));
                    changed = true;
                }
                
                if (changed) {
                    if (state.currentView === "dashboard") {
                        renderDashboard();
                    } else if (state.currentView === "customers") {
                        renderCustomersTable();
                    } else if (state.currentView === "history") {
                        renderHistoryTable();
                    } else if (state.currentView === "emails") {
                        renderEmailOutbox();
                    }
                }
            }
        } catch (err) {
            console.error("Failed to pull latest data from server:", err);
        }
    }

    async function bootApp() {
        // Try to fetch from server first
        try {
            const response = await fetch("/api/data");
            if (response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const data = await response.json();
                    isServerSyncEnabled = true;
                    
                    // Overwrite state and write to localStorage if server has datasets
                    if (data.customers) {
                        state.customers = data.customers;
                        localStorage.setItem("qr_customers", JSON.stringify(data.customers));
                    }
                    if (data.logs) {
                        state.logs = data.logs;
                        localStorage.setItem("qr_checkin_logs", JSON.stringify(data.logs));
                    }
                    if (data.users) {
                        state.users = data.users;
                        localStorage.setItem("qr_users", JSON.stringify(data.users));
                    }
                    if (data.emails) {
                        state.emails = data.emails;
                        localStorage.setItem("qr_emails", JSON.stringify(data.emails));
                    }
                    if (data.activityFeed) {
                        state.activityFeed = data.activityFeed;
                        localStorage.setItem("qr_activity_feed", JSON.stringify(data.activityFeed));
                    }
                    if (data.settings) {
                        state.settings = data.settings;
                        localStorage.setItem("qr_settings", JSON.stringify(data.settings));
                    }
                    
                    // Show LAN Sync Badge
                    const syncIndicator = document.getElementById("header-sync-indicator");
                    if (syncIndicator) syncIndicator.classList.remove("hide");
                    
                    console.log("Database successfully synced with LAN Machine Server.");
                }
            }
        } catch (err) {
            console.log("Sync Server not detected. Running in standalone browser mode.");
        }

        initStorage();

    // --- FIREBASE SYNC LISTENER ---
    if (typeof db !== 'undefined' && db) {
        db.ref('event_data').once('value').then((snapshot) => {
            if (!snapshot.exists() || !snapshot.val()) {
                console.log("Firebase is empty. Seeding from local data.");
                db.ref('event_data').set({
                    users: state.users || [],
                    customers: state.customers || [],
                    logs: state.logs || [],
                    emails: state.emails || [],
                    activityFeed: state.activityFeed || [],
                    settings: state.settings || {}
                });
            }
        });

        db.ref('event_data').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                console.log("Firebase data updated, syncing to UI.");
                if (data.users) {
                    state.users = data.users;
                    localStorage.setItem('qr_users', JSON.stringify(data.users));
                }
                if (data.customers) {
                    state.customers = data.customers;
                    localStorage.setItem('qr_customers', JSON.stringify(data.customers));
                    if (typeof renderCustomerTable === 'function') renderCustomerTable();
                    if (typeof renderDashboardStats === 'function') renderDashboardStats();
                }
                if (data.logs) {
                    state.logs = data.logs;
                    localStorage.setItem('qr_checkin_logs', JSON.stringify(data.logs));
                    if (typeof renderLogs === 'function') renderLogs();
                }
                if (data.emails) {
                    state.emails = data.emails;
                    localStorage.setItem('qr_emails', JSON.stringify(data.emails));
                }
                if (data.activityFeed) {
                    state.activityFeed = data.activityFeed;
                    localStorage.setItem('qr_activity_feed', JSON.stringify(data.activityFeed));
                    if (typeof renderActivityFeed === 'function') renderActivityFeed();
                }
                if (data.settings) {
                    state.settings = data.settings;
                    localStorage.setItem('qr_settings', JSON.stringify(data.settings));
                }
            }
        });
    }

        checkLoginSession();
        loadCameras();
        renderActivityFeed();
        renderDashboard();
        
    // ----------------------------------------------------------------------
    // XVIII. GOOGLE SHEETS DATABASE SYNC ENGINE
    // ----------------------------------------------------------------------
    const GOOGLE_APPS_SCRIPT_CODE = `// GOOGLE APPS SCRIPT - DATABASE ENGINE FOR QR CHECK-IN
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
  }
  var headers = data[0];
  var rows = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = {};
    var hasData = false;
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
      if (data[i][j] !== "") hasData = true;
    }
    if (hasData) {
      row["_rowNum"] = i + 1; // Row number in sheet
      rows.push(row);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var payload = JSON.parse(e.postData.contents);
  var headers = sheet.getDataRange().getValues()[0];
  
  var ticketId = payload.id;
  var action = payload.action; // "checkin" or "add_customer"
  
  // Find the ticket ID column
  var idColIdx = -1;
  var possibleIdHeaders = ["Mã Vé / ID", "Mã Vé", "ID", "Id", "id", "Ticket ID", "TicketID", "Mã số", "Mã"];
  for (var k = 0; k < headers.length; k++) {
    if (possibleIdHeaders.map(function(h){return h.toLowerCase();}).indexOf(headers[k].toLowerCase()) !== -1) {
      idColIdx = k;
      break;
    }
  }
  
  if (idColIdx === -1) {
    idColIdx = 0;
  }
  
  var rowNum = payload.rowNum;
  
  if (!rowNum && ticketId) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idColIdx]).trim() === String(ticketId).trim()) {
        rowNum = i + 1;
        break;
      }
    }
  }
  
  var statusCol = headers.indexOf("Trạng Thái Check-in") + 1;
  var timeCol = headers.indexOf("Thời Gian Check-in") + 1;
  var locCol = headers.indexOf("Địa Điểm Check-in") + 1;
  var staffCol = headers.indexOf("Người Soát Vé") + 1;
  
  if (statusCol === 0) { statusCol = headers.length + 1; sheet.getRange(1, statusCol).setValue("Trạng Thái Check-in"); }
  if (timeCol === 0) { timeCol = headers.length + 2; sheet.getRange(1, timeCol).setValue("Thời Gian Check-in"); }
  if (locCol === 0) { locCol = headers.length + 3; sheet.getRange(1, locCol).setValue("Địa Điểm Check-in"); }
  if (staffCol === 0) { staffCol = headers.length + 4; sheet.getRange(1, staffCol).setValue("Người Soát Vé"); }
  
  if (action === "add_customer") {
    var newRow = new Array(headers.length);
    var namePossibles = ["HoVaTen", "Họ tên", "Họ và tên", "Họ và Tên", "Name", "Full Name", "Khách hàng", "Tên khách hàng", "Học sinh", "Tên học sinh"];
    var phonePossibles = ["SoDienThoai", "Số điện thoại", "SĐT", "Phone", "SDT", "Số ĐT", "Điện thoại", "Telephone"];
    var emailPossibles = ["Email", "Mail", "Địa chỉ email", "Gmail"];
    
    for (var j = 0; j < headers.length; j++) {
      var headerLower = headers[j].toLowerCase();
      if (j === idColIdx) {
        newRow[j] = ticketId;
      } else if (namePossibles.map(function(h){return h.toLowerCase();}).indexOf(headerLower) !== -1) {
        newRow[j] = payload.HoVaTen || "";
      } else if (phonePossibles.map(function(h){return h.toLowerCase();}).indexOf(headerLower) !== -1) {
        newRow[j] = payload.SoDienThoai || "";
      } else if (emailPossibles.map(function(h){return h.toLowerCase();}).indexOf(headerLower) !== -1) {
        newRow[j] = payload.Email || "";
      } else if (payload[headers[j]] !== undefined) {
        newRow[j] = payload[headers[j]];
      } else {
        newRow[j] = "";
      }
    }
    
    sheet.appendRow(newRow);
    var newRowNum = sheet.getLastRow();
    
    sheet.getRange(newRowNum, statusCol).setValue(payload.status || "Pending");
    if (payload.status === "Checked In") {
      sheet.getRange(newRowNum, timeCol).setValue(payload.checkInTime || new Date().toISOString());
      sheet.getRange(newRowNum, locCol).setValue(payload.location || "Lối vào");
      sheet.getRange(newRowNum, staffCol).setValue(payload.staff || "Nhân viên");
    }
    
    return ContentService.createTextOutput(JSON.stringify({"status": "success", "rowNum": newRowNum}))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
  } else {
    if (rowNum) {
      sheet.getRange(rowNum, statusCol).setValue("Checked In");
      sheet.getRange(rowNum, timeCol).setValue(payload.checkInTime || new Date().toISOString());
      sheet.getRange(rowNum, locCol).setValue(payload.location || "Lối vào");
      sheet.getRange(rowNum, staffCol).setValue(payload.staff || "Nhân viên");
      return ContentService.createTextOutput(JSON.stringify({"status": "success"}))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader("Access-Control-Allow-Origin", "*");
    } else {
      return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": "Ticket ID not found"}))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader("Access-Control-Allow-Origin", "*");
    }
  }
}
`;

    const sheetsForm = document.getElementById("settings-sheets-form");
    const sheetsSyncEnabled = document.getElementById("sheets-sync-enabled");
    const sheetsScriptUrl = document.getElementById("sheets-script-url");
    const btnShowSheetsGuide = document.getElementById("btn-show-sheets-guide");
    const modalSheetsGuide = document.getElementById("modal-sheets-guide");
    const btnCloseSheetsGuideModal = document.getElementById("btn-close-sheets-guide-modal");
    const btnCloseSheetsGuideOk = document.getElementById("btn-close-sheets-guide-ok");
    const btnCopyScriptCode = document.getElementById("btn-copy-script-code");

    let sheetsSyncIntervalId = null;
    let isSyncing = false;

    // Show Apps Script Guide Modal
    btnShowSheetsGuide.addEventListener("click", () => {
        modalSheetsGuide.classList.add("active");
        document.getElementById("sheets-script-code").value = GOOGLE_APPS_SCRIPT_CODE;
    });

    btnCloseSheetsGuideModal.addEventListener("click", () => {
        modalSheetsGuide.classList.remove("active");
    });
    btnCloseSheetsGuideOk.addEventListener("click", () => {
        modalSheetsGuide.classList.remove("active");
    });

    // Copy script code
    btnCopyScriptCode.addEventListener("click", () => {
        const txt = document.getElementById("sheets-script-code");
        txt.select();
        navigator.clipboard.writeText(txt.value).then(() => {
            showToast("Đã sao chép", "Mã Google Apps Script đã được lưu vào bộ nhớ tạm.", "success");
        }).catch(err => {
            console.error("Copy failed:", err);
            showToast("Lỗi sao chép", "Không thể tự động sao chép mã. Vui lòng chọn thủ công.", "error");
        });
    });

    // Save sheets settings form
    sheetsForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const enabled = sheetsSyncEnabled.checked;
        const scriptUrl = sheetsScriptUrl.value.trim();

        if (enabled && !scriptUrl) {
            showToast("Thiếu URL", "Vui lòng nhập URL Google Apps Script Web App để đồng bộ.", "warning");
            return;
        }

        state.settings.sheets = {
            enabled: enabled,
            scriptUrl: scriptUrl
        };
        saveState("settings");

        showToast("Cấu hình lưu", "Đã cập nhật cài đặt đồng bộ Google Sheets thành công.", "success");
        playNotificationSound("success");
        updateSheetsSyncIndicator("success");

        if (enabled) {
            await syncWithGoogleSheets();
            startSheetsSyncInterval();
        } else {
            stopSheetsSyncInterval();
        }
    });

    // Google Sheets Sync Functions
    async function syncWithGoogleSheets() {
        if (!state.settings.sheets || !state.settings.sheets.enabled || !state.settings.sheets.scriptUrl) {
            return;
        }
        if (isSyncing) return;
        isSyncing = true;
        updateSheetsSyncIndicator("syncing");

        try {
            const url = state.settings.sheets.scriptUrl;
            const response = await fetch(url);
            if (!response.ok) throw new Error("HTTP error " + response.status);
            
            const sheetRows = await response.json();
            if (!Array.isArray(sheetRows)) throw new Error("Invalid response format");

            if (sheetRows.length === 0) {
                isSyncing = false;
                updateSheetsSyncIndicator("success");
                return;
            }

            const firstRow = sheetRows[0];
            const headers = Object.keys(firstRow).filter(k => k !== "_rowNum");

            if (!state.settings.columnMapping) {
                state.settings.columnMapping = {
                    name: findBestMatch(headers, namePossibles),
                    phone: findBestMatch(headers, phonePossibles),
                    email: findBestMatch(headers, emailPossibles),
                    id: findBestMatch(headers, idPossibles)
                };
                saveState("settings");
            }

            const mapping = state.settings.columnMapping;
            const nameCol = mapping.name || headers[0];
            const phoneCol = mapping.phone;
            const emailCol = mapping.email;
            const idCol = mapping.id;

            const statusHeader = headers.find(h => ["Trạng Thái Check-in", "Trạng Táhi Check-in", "Trạng Thái", "Status"].includes(h)) || "Trạng Thái Check-in";
            const timeHeader = headers.find(h => ["Thời Gian Check-in", "Thời gian", "Time"].includes(h)) || "Thời Gian Check-in";
            const locationHeader = headers.find(h => ["Địa Điểm Check-in", "Địa điểm", "Location"].includes(h)) || "Địa Điểm Check-in";
            const staffHeader = headers.find(h => ["Người Soát Vé", "Nhân viên", "Staff", "User"].includes(h)) || "Người Soát Vé";

            let localUpdated = false;
            const tempCustomers = [...state.customers];

            sheetRows.forEach(row => {
                const HoVaTen = nameCol ? String(row[nameCol] || "").trim() : "";
                if (!HoVaTen) return;

                const SoDienThoai = phoneCol ? String(row[phoneCol] || "").trim() : "";
                const Email = emailCol ? String(row[emailCol] || "").trim() : "";
                const ticketId = idCol ? String(row[idCol] || "").trim() : "";
                if (!ticketId) return;

                const sheetStatus = String(row[statusHeader] || "").trim();
                const isSheetCheckedIn = (sheetStatus.toLowerCase() === "checked in" || sheetStatus === "da check-in" || sheetStatus === "CheckedIn" || sheetStatus === "Checked In");
                const sheetTime = row[timeHeader] ? new Date(row[timeHeader]).toISOString() : null;
                const sheetLocation = row[locationHeader] || "Lối vào";
                const sheetStaff = row[staffHeader] || "Nhân viên";
                const _rowNum = row["_rowNum"];

                let localCust = tempCustomers.find(c => c.id === ticketId);

                if (localCust) {
                    localCust._rowNum = _rowNum;

                    if (isSheetCheckedIn && localCust.status !== "Checked In") {
                        localCust.status = "Checked In";
                        localCust.checkInTime = sheetTime || new Date().toISOString();
                        localCust.checkInLocation = sheetLocation;
                        localCust.checkedBy = sheetStaff;

                        const logExists = state.logs.some(l => l.customerId === localCust.id);
                        if (!logExists) {
                            state.logs.push({
                                id: "log-" + Date.now() + Math.random().toString(36).substr(2, 4),
                                customerId: localCust.id,
                                customerName: localCust.HoVaTen,
                                checkInTime: localCust.checkInTime,
                                location: localCust.checkInLocation,
                                checkedBy: localCust.checkedBy
                            });
                        }
                        localUpdated = true;
                        showToast("Đồng bộ check-in", `Khách "${localCust.HoVaTen}" được check-in từ thiết bị khác.`, "info");
                    } else if (!isSheetCheckedIn && localCust.status === "Checked In") {
                        postCheckInToGoogleSheets(localCust);
                    }

                    if (localCust.HoVaTen !== HoVaTen) { localCust.HoVaTen = HoVaTen; localUpdated = true; }
                    if (localCust.SoDienThoai !== SoDienThoai) { localCust.SoDienThoai = SoDienThoai; localUpdated = true; }
                    if (localCust.Email !== Email) { localCust.Email = Email; localUpdated = true; }

                    headers.forEach(h => {
                        if (h !== nameCol && h !== phoneCol && h !== emailCol && h !== idCol && h !== statusHeader && h !== timeHeader && h !== locationHeader && h !== staffHeader) {
                            if (row[h] !== undefined && row[h] !== null && localCust[h] !== String(row[h]).trim()) {
                                localCust[h] = String(row[h]).trim();
                                localUpdated = true;
                            }
                        }
                    });
                } else {
                    const newCust = {
                        id: ticketId,
                        HoVaTen,
                        SoDienThoai,
                        Email,
                        status: isSheetCheckedIn ? "Checked In" : "Pending",
                        qrCode: `QRCHECKIN-${ticketId}`,
                        checkInTime: isSheetCheckedIn ? sheetTime : null,
                        checkInLocation: isSheetCheckedIn ? sheetLocation : null,
                        checkedBy: isSheetCheckedIn ? sheetStaff : null,
                        _rowNum
                    };

                    headers.forEach(h => {
                        if (h !== nameCol && h !== phoneCol && h !== emailCol && h !== idCol && h !== statusHeader && h !== timeHeader && h !== locationHeader && h !== staffHeader) {
                            if (row[h] !== undefined && row[h] !== null) {
                                newCust[h] = String(row[h]).trim();
                            }
                        }
                    });

                    state.customers.push(newCust);

                    if (isSheetCheckedIn) {
                        state.logs.push({
                            id: "log-" + Date.now() + Math.random().toString(36).substr(2, 4),
                            customerId: newCust.id,
                            customerName: newCust.HoVaTen,
                            checkInTime: newCust.checkInTime,
                            location: newCust.checkInLocation,
                            checkedBy: newCust.checkedBy
                        });
                    }
                    localUpdated = true;
                }
            });

            state.customers.forEach(localCust => {
                if (!localCust._rowNum) {
                    postNewCustomerToGoogleSheets(localCust);
                }
            });

            if (localUpdated) {
                saveState("customers");
                saveState("logs");
                renderCustomersTable();
                renderDashboard();
            }
            updateSheetsSyncIndicator("success");
        } catch (err) {
            console.error("Google Sheets sync failed:", err);
            updateSheetsSyncIndicator("error");
        } finally {
            isSyncing = false;
        }
    }

    async function postCheckInToGoogleSheets(customer) {
        if (!state.settings.sheets || !state.settings.sheets.enabled || !state.settings.sheets.scriptUrl) {
            return;
        }
        try {
            const payload = {
                action: "checkin",
                id: customer.id,
                rowNum: customer._rowNum || null,
                checkInTime: customer.checkInTime || new Date().toISOString(),
                location: customer.checkInLocation || "Lối vào chính",
                staff: customer.checkedBy || "Nhân viên trực"
            };

            const response = await fetch(state.settings.sheets.scriptUrl, {
                method: "POST",
                mode: "cors",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result && result.status === "success") {
                console.log(`Successfully synced check-in for ${customer.HoVaTen} to Google Sheets.`);
            }
        } catch (err) {
            console.error("Failed to post check-in to Google Sheets:", err);
        }
    }

    async function postNewCustomerToGoogleSheets(customer) {
        if (!state.settings.sheets || !state.settings.sheets.enabled || !state.settings.sheets.scriptUrl) {
            return;
        }
        try {
            const payload = {
                action: "add_customer",
                id: customer.id,
                HoVaTen: customer.HoVaTen,
                SoDienThoai: customer.SoDienThoai,
                Email: customer.Email,
                status: customer.status || "Pending",
                checkInTime: customer.checkInTime || null,
                location: customer.checkInLocation || null,
                staff: customer.checkedBy || null
            };

            const systemKeys = ["id", "qrCode", "status", "checkInTime", "checkInLocation", "checkedBy", "HoVaTen", "SoDienThoai", "Email", "_rowNum"];
            Object.keys(customer).forEach(key => {
                if (!systemKeys.includes(key)) {
                    payload[key] = customer[key];
                }
            });

            const response = await fetch(state.settings.sheets.scriptUrl, {
                method: "POST",
                mode: "cors",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result && result.status === "success") {
                customer._rowNum = result.rowNum;
                saveState("customers");
                console.log(`Successfully synced new customer ${customer.HoVaTen} with row ${result.rowNum}.`);
            }
        } catch (err) {
            console.error("Failed to post new customer to Google Sheets:", err);
        }
    }

    function startSheetsSyncInterval() {
        stopSheetsSyncInterval();
        if (state.settings.sheets && state.settings.sheets.enabled && state.settings.sheets.scriptUrl) {
            syncWithGoogleSheets();
            sheetsSyncIntervalId = setInterval(syncWithGoogleSheets, 10000);
            console.log("Google Sheets auto-sync interval started (10s).");
        }
    }

    function stopSheetsSyncInterval() {
        if (sheetsSyncIntervalId) {
            clearInterval(sheetsSyncIntervalId);
            sheetsSyncIntervalId = null;
            console.log("Google Sheets auto-sync interval stopped.");
        }
    }

    function updateSheetsSyncIndicator(status) {
        const syncIndicator = document.getElementById("header-sync-indicator");
        if (!syncIndicator) return;

        if (state.settings.sheets && state.settings.sheets.enabled && state.settings.sheets.scriptUrl) {
            syncIndicator.classList.remove("hide");
            const dot = syncIndicator.querySelector(".sync-dot");
            const text = syncIndicator.querySelector(".sync-text");
            
            text.textContent = "Google Sheets";
            if (status === "syncing") {
                dot.style.background = "#eab308"; // Warning yellow
                dot.style.boxShadow = "0 0 8px #eab308";
            } else if (status === "success") {
                dot.style.background = "#10b981"; // Success green
                dot.style.boxShadow = "0 0 8px #10b981";
            } else if (status === "error") {
                dot.style.background = "#ef4444"; // Danger red
                dot.style.boxShadow = "0 0 8px #ef4444";
            }
        } else {
            if (!isServerSyncEnabled) {
                syncIndicator.classList.add("hide");
            } else {
                syncIndicator.querySelector(".sync-text").textContent = "Máy chủ LAN";
                syncIndicator.querySelector(".sync-dot").style.background = "#10b981";
                syncIndicator.querySelector(".sync-dot").style.boxShadow = "0 0 8px #10b981";
            }
        }
    }


        // Start polling if sync is enabled
        if (isServerSyncEnabled) {
            setInterval(pullLatestDataFromServer, 5000);
        }

        // Start Google Sheets sync if enabled
        if (state.settings.sheets && state.settings.sheets.enabled && state.settings.sheets.scriptUrl) {
            startSheetsSyncInterval();
            updateSheetsSyncIndicator("success");
        }
    }

    bootApp();
});
