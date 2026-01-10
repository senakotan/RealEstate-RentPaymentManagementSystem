document.addEventListener("DOMContentLoaded", async () => {
  // Yetki Kontrolü
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }
  const user = JSON.parse(userStr);

  if (user.rol !== "Admin") {
    alert("Bu sayfaya sadece adminler erişebilir.");
    window.location.href = "../index.html";
    return;
  }

  // Header Bilgileri
  document.getElementById("headerUserName").innerText = user.adSoyad;
  document.getElementById("userImg").src = `https://ui-avatars.com/api/?name=${user.adSoyad}&background=ff6b6b&color=fff`;

  // Kullanıcı bilgilerini backend'den çek
  try {
    const userData = await API.get(`/Kullanici/${user.kullaniciID}`);
    if (userData) {
      document.getElementById("adSoyad").value = userData.adSoyad || userData.AdSoyad || user.adSoyad;
      document.getElementById("telefon").value = userData.telefon || userData.Telefon || user.telefon || "";
      document.getElementById("tcNo").value = userData.tcNo || userData.TCNo || user.tcNo || "";
      document.getElementById("email").value = userData.email || userData.Email || user.email;
    } else {
      document.getElementById("adSoyad").value = user.adSoyad;
      document.getElementById("telefon").value = user.telefon || "";
      document.getElementById("tcNo").value = user.tcNo || "";
      document.getElementById("email").value = user.email;
    }
  } catch (e) {
    console.error("Kullanıcı bilgisi yüklenemedi:", e);
    document.getElementById("adSoyad").value = user.adSoyad;
    document.getElementById("telefon").value = user.telefon || "";
    document.getElementById("tcNo").value = user.tcNo || "";
    document.getElementById("email").value = user.email;
  }
});

document.getElementById("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const user = JSON.parse(localStorage.getItem("user"));
  const yeniSifre = document.getElementById("yeniSifre").value;

  const updateData = {
    kullaniciID: user.kullaniciID,
    adSoyad: document.getElementById("adSoyad").value,
    telefon: document.getElementById("telefon").value || null,
    tcNo: document.getElementById("tcNo").value || null,
    email: user.email,
    aktifMi: true,
  };

  // Şifre değiştiriliyorsa ekle
  if (yeniSifre && yeniSifre.length > 0) {
    if (yeniSifre.length < 6) {
      alert("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    updateData.sifreHash = yeniSifre;
  }

  try {
    const submitBtn = e.target.querySelector("button[type=submit]");
    const originalText = submitBtn.innerText;
    submitBtn.innerText = "Kaydediliyor...";
    submitBtn.disabled = true;

    const res = await API.put(`/Kullanici/${user.kullaniciID}`, updateData);

    if (res) {
      // LocalStorage'ı güncelle
      const updatedUser = {
        ...user,
        adSoyad: updateData.adSoyad,
        telefon: updateData.telefon,
        tcNo: updateData.tcNo
      };
      localStorage.setItem("user", JSON.stringify(updatedUser));

      if (yeniSifre) {
        alert("Profil ve şifre güncellendi! Lütfen tekrar giriş yapın.");
        localStorage.removeItem("user");
        window.location.href = "../index.html";
      } else {
        alert("Profil başarıyla güncellendi!");
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
      }
    }
  } catch (err) {
    console.error(err);
    alert("Güncelleme sırasında hata oluştu: " + (err.message || "Bilinmeyen hata"));
    const submitBtn = e.target.querySelector("button[type=submit]");
    if (submitBtn) {
      submitBtn.innerText = "Değişiklikleri Kaydet";
      submitBtn.disabled = false;
    }
  }
});

// Çıkış
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});


