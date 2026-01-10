// =============================================
// UTILITY FONKSİYONLARI
// =============================================

// Bildirim Badge'ini Güncelle (Tüm sayfalarda kullanılabilir)
async function updateNotificationBadge() {
  const userStr = localStorage.getItem("user");
  if (!userStr) return;
  
  const user = JSON.parse(userStr);
  const badgeEl = document.getElementById("notificationBadge");
  
  if (!badgeEl) return;
  
  const userId = user.kullaniciID || user.KullaniciID;
  if (!userId) return;
  
  try {
    const unreadCount = await API.get(`/Bildirim/unread-count/${userId}`);
    if (unreadCount !== null && unreadCount !== undefined) {
      if (unreadCount > 0) {
        badgeEl.innerText = unreadCount;
        badgeEl.style.display = "inline-block";
      } else {
        badgeEl.style.display = "none";
      }
    }
  } catch (e) {
    // Sessiz hata yönetimi
  }
}

// Tarih Formatlama (dd.MM.yyyy)
function formatDate(dateString) {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  } catch (e) {
    return "-";
  }
}

// Tarih ve Saat Formatlama (dd.MM.yyyy HH:mm)
function formatDateTime(dateString) {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch (e) {
    return "-";
  }
}

// Para Formatlama
function formatCurrency(amount, currency = "TRY") {
  if (amount === null || amount === undefined) return "-";
  try {
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return "-";
    
    // Türk Lirası için özel formatlama
    if (currency === "TRY" || currency === "TL") {
      return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(numAmount);
    }
    
    // Diğer para birimleri için
    return new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numAmount) + " " + currency;
  } catch (e) {
    return amount + " " + currency;
  }
}

// Kullanıcı Bilgisi Kontrolü
function getCurrentUser() {
  const userStr = localStorage.getItem("user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
}

// Yetki Kontrolü
function checkAuth(requiredRole = null) {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = "../index.html";
    return false;
  }
  
  if (requiredRole && user.rol !== requiredRole) {
    window.location.href = "../index.html";
    return false;
  }
  
  return true;
}

// Loading State Yönetimi
function showLoading(elementId, message = "Yükleniyor...") {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = `<p style="text-align:center; color:#888; padding:1rem;"><i class="fa-solid fa-spinner fa-spin"></i> ${message}</p>`;
  }
}

function hideLoading(elementId, defaultContent = "") {
  const element = document.getElementById(elementId);
  if (element && defaultContent) {
    element.innerHTML = defaultContent;
  }
}

// Hata Mesajı Gösterme
function showErrorMessage(elementId, message, duration = 5000) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerText = message;
    element.style.display = "block";
    element.style.background = "#ff4b5c";
    element.style.color = "#fff";
    element.style.padding = "12px";
    element.style.borderRadius = "8px";
    element.style.marginBottom = "1rem";
    
    if (duration > 0) {
      setTimeout(() => {
        element.style.display = "none";
      }, duration);
    }
  }
}

// Başarı Mesajı Gösterme
function showSuccessMessage(elementId, message, duration = 3000) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerText = message;
    element.style.display = "block";
    element.style.background = "#4caf50";
    element.style.color = "#fff";
    element.style.padding = "12px";
    element.style.borderRadius = "8px";
    element.style.marginBottom = "1rem";
    
    if (duration > 0) {
      setTimeout(() => {
        element.style.display = "none";
      }, duration);
    }
  }
}

// Alert/Toast Göster (Tüm sayfalarda kullanılabilir - alert yerine)
function showAlert(message, type = "error") {
  // Eğer alert kullanmak isterseniz direkt alert göster
  // Daha güzel bir toast notification için bu fonksiyonu kullanabilirsiniz
  if (type === "error") {
    alert("❌ Hata: " + message);
  } else if (type === "success") {
    alert("✅ " + message);
  } else {
    alert(message);
  }
}

// Form Validasyonu
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePhone(phone) {
  const phoneRegex = /^[0-9]{10,11}$/;
  return phoneRegex.test(phone.replace(/\s/g, ""));
}

function validateTCNo(tcNo) {
  if (!tcNo) return true; // Opsiyonel
  const tcRegex = /^[0-9]{11}$/;
  return tcRegex.test(tcNo);
}

// Sayfa yüklendiğinde badge'i güncelle
document.addEventListener("DOMContentLoaded", () => {
  updateNotificationBadge();
  // Her 30 saniyede bir güncelle
  setInterval(updateNotificationBadge, 30000);
});


