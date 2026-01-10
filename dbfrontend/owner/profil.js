document.addEventListener("DOMContentLoaded", async () => {
  // Yetki Kontrolü
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }
  const user = JSON.parse(userStr);

  if (user.rol !== "Owner") {
    alert("Bu sayfaya sadece mülk sahipleri erişebilir.");
    window.location.href = "../index.html";
    return;
  }

  // Header Bilgileri
  document.getElementById("headerUserName").innerText = user.adSoyad;
  document.getElementById(
    "userImg"
  ).src = `https://ui-avatars.com/api/?name=${user.adSoyad}&background=00d4ff&color=fff`;

  // Kullanıcı bilgilerini backend'den çek (güncel veri için)
  try {
    const userData = await API.get(`/Kullanici/${user.kullaniciID}`);
    if (userData) {
      // Formu Doldur
      document.getElementById("adSoyad").value = userData.adSoyad || userData.AdSoyad || user.adSoyad;
      document.getElementById("telefon").value = userData.telefon || userData.Telefon || user.telefon || "";
      document.getElementById("tcNo").value = userData.tcNo || userData.TCNo || user.tcNo || "";
      document.getElementById("email").value = userData.email || userData.Email || user.email;
    } else {
      // Fallback: localStorage'dan doldur
      document.getElementById("adSoyad").value = user.adSoyad;
      document.getElementById("telefon").value = user.telefon || "";
      document.getElementById("tcNo").value = user.tcNo || "";
      document.getElementById("email").value = user.email;
    }
  } catch (e) {
    console.error("Kullanıcı bilgisi yüklenemedi:", e);
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
    email: yeniEmail, // Email değiştirilebilir
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

    // Backend'deki Update metodu zaten email ile Kiraci'yi senkronize ediyor (AdSoyad ve Telefon için)
    // Ama email güncellemesi için frontend'de de Kiraci güncellemesi yapmalıyız
    
    // ÖNCE email ile KiraciID'yi bul (Kullanici güncellemeden önce)
    let kiraciID = null;
    try {
      const allTenants = await API.get("/Kiraci");
      if (allTenants && Array.isArray(allTenants)) {
        // Önce eski email ile bul (backend mantığına göre)
        const tenantByOldEmail = allTenants.find(t => {
          const tEmail = (t.email || t.Email || "").trim().toLowerCase();
          return tEmail && tEmail === user.email.trim().toLowerCase();
        });
        
        if (tenantByOldEmail) {
          kiraciID = tenantByOldEmail.kiraciID || tenantByOldEmail.KiraciID;
          console.log("✅ KiraciID eski email ile bulundu:", kiraciID);
        } else {
          // Eğer eski email ile bulunamadıysa, yeni email ile bul
          const tenantByNewEmail = allTenants.find(t => {
            const tEmail = (t.email || t.Email || "").trim().toLowerCase();
            return tEmail && tEmail === yeniEmail;
          });
          
          if (tenantByNewEmail) {
            kiraciID = tenantByNewEmail.kiraciID || tenantByNewEmail.KiraciID;
            console.log("✅ KiraciID yeni email ile bulundu:", kiraciID);
          }
        }
      }
    } catch (findError) {
      console.warn("⚠️ KiraciID bulunurken hata (devam ediliyor):", findError);
    }

    // Kullanici tablosunu güncelle (Backend otomatik olarak Kiraci'yi senkronize edecek - AdSoyad ve Telefon için)
    const res = await API.put(`/Kullanici/${user.kullaniciID}`, updateData);

    if (res) {
      // Backend zaten AdSoyad ve Telefon'u senkronize etti
      // Email güncellemesi için frontend'de de Kiraci güncellemesi yapmalıyız
      if (kiraciID) {
        try {
          const kiraciData = {
            adSoyad: updateData.adSoyad.trim(), // Backend zaten güncelledi ama email için de güncelle
            email: yeniEmail, // EMAIL GÜNCELLEMESİ - Backend bunu yapmıyor, frontend yapıyor
            telefon: updateData.telefon || null, // Backend zaten güncelledi ama tekrar gönder
            tcNo: updateData.tcNo || null,
            aktifMi: true
          };

          console.log("🔄 Kiraci email güncelleniyor (Backend AdSoyad/Telefon'u zaten güncelledi)...", {
            kiraciID: kiraciID,
            kiraciData: kiraciData
          });

          await API.put(`/Kiraci/${kiraciID}`, kiraciData);
          console.log("✅ Kiraci email başarıyla güncellendi (Backend AdSoyad/Telefon'u zaten senkronize etti)");
        } catch (kiraciError) {
          console.error("❌ Kiraci email güncelleme hatası:", kiraciError);
          // Kiraci email güncelleme hatası olsa bile Kullanici güncellendi ve backend AdSoyad/Telefon'u senkronize etti
        }
      } else {
        console.log("ℹ️ KiraciID bulunamadı. Backend AdSoyad/Telefon senkronizasyonu yapılamadı, ama Kullanici güncellendi.");
      }

      // LocalStorage'ı güncelle
      const updatedUser = {
        ...user,
        adSoyad: updateData.adSoyad,
        telefon: updateData.telefon,
        tcNo: updateData.tcNo,
        email: updateData.email // Email'i de güncelle
      };
      localStorage.setItem("user", JSON.stringify(updatedUser));

      if (yeniSifre) {
        alert("Profil ve şifre güncellendi! Lütfen tekrar giriş yapın.");
        localStorage.removeItem("user");
        window.location.href = "../index.html";
      } else {
        alert("Profil başarıyla güncellendi!" + (kiraciID ? " Kiracı bilgileri de senkronize edildi." : ""));
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


