document.addEventListener("DOMContentLoaded", async () => {
  // Yetki Kontrolü
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }
  const user = JSON.parse(userStr);

  // Header Bilgileri
  document.getElementById("headerUserName").innerText = user.adSoyad;
  document.getElementById(
    "userImg"
  ).src = `https://ui-avatars.com/api/?name=${user.adSoyad}&background=764ba2&color=fff`;

  // Kullanıcı bilgilerini backend'den çek (güncel veri için) - Owner profili gibi
  try {
    const userData = await API.get(`/Kullanici/${user.kullaniciID}`);
    if (userData) {
      // Formu backend'den gelen verilerle doldur
      document.getElementById("adSoyad").value = userData.adSoyad || userData.AdSoyad || user.adSoyad;
      document.getElementById("telefon").value = userData.telefon || userData.Telefon || user.telefon || "";
      document.getElementById("tcNo").value = userData.tcNo || userData.TCNo || user.tcNo || "";
      document.getElementById("email").value = userData.email || userData.Email || user.email;
      
      // Header'ı da backend'den gelen verilerle güncelle
      const adSoyad = userData.adSoyad || userData.AdSoyad || user.adSoyad;
      document.getElementById("headerUserName").innerText = adSoyad;
      document.getElementById("userImg").src = `https://ui-avatars.com/api/?name=${encodeURIComponent(adSoyad)}&background=764ba2&color=fff`;
    } else {
      // Fallback: localStorage'dan doldur
      document.getElementById("adSoyad").value = user.adSoyad;
      document.getElementById("telefon").value = user.telefon || "";
      document.getElementById("tcNo").value = user.tcNo || "";
      document.getElementById("email").value = user.email;
    }
  } catch (e) {
    // Fallback: localStorage'dan doldur
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
  const yeniEmail = document.getElementById("email").value.trim().toLowerCase();

  // Email validasyonu
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(yeniEmail)) {
    alert("Geçerli bir e-posta adresi giriniz.");
    return;
  }

  const updateData = {
    kullaniciID: user.kullaniciID,
    adSoyad: document.getElementById("adSoyad").value,
    telefon: document.getElementById("telefon").value || null,
    tcNo: document.getElementById("tcNo").value || null,
    email: yeniEmail,
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

    // KiraciID'yi KullaniciID ile bul
    let kiraciID = null;
    try {
      const tenantData = await API.get(`/Kiraci/kullanici/${user.kullaniciID}`);
      if (tenantData) {
        kiraciID = tenantData.kiraciID || tenantData.KiraciID;
      }
    } catch (findError) {
      // KiraciID bulunamadı, devam et
    }

    // Kullanici tablosunu güncelle
    const res = await API.put(`/Kullanici/${user.kullaniciID}`, updateData);

    if (res) {
      // Kiraci tablosunu da güncelle (senkronizasyon için)
      if (kiraciID) {
        try {
          const kiraciData = {
            adSoyad: updateData.adSoyad.trim(),
            email: yeniEmail,
            telefon: updateData.telefon || null,
            tcNo: updateData.tcNo || null,
            aktifMi: true
          };

          await API.put(`/Kiraci/${kiraciID}`, kiraciData);
        } catch (kiraciError) {
          // Kiraci güncelleme hatası
        }
      }

      // LocalStorage'ı güncelle
      const updatedUser = {
        ...user,
        adSoyad: updateData.adSoyad,
        telefon: updateData.telefon,
        tcNo: updateData.tcNo,
        email: updateData.email
      };
      localStorage.setItem("user", JSON.stringify(updatedUser));

      // Header'ı güncelle
      document.getElementById("headerUserName").innerText = updateData.adSoyad;
      document.getElementById("userImg").src = `https://ui-avatars.com/api/?name=${encodeURIComponent(updateData.adSoyad)}&background=764ba2&color=fff`;

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
