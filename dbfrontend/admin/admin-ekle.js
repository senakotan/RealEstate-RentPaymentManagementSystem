document.addEventListener("DOMContentLoaded", async () => {
  // Yetki Kontrolü
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }
  const user = JSON.parse(userStr);
  if (user.rol !== "Admin") {
    alert("Bu sayfaya erişim yetkiniz yok. Sadece adminler yeni admin ekleyebilir.");
    window.location.href = "../index.html";
    return;
  }

  // Form Submit
  document.getElementById("adminForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const adSoyad = document.getElementById("adSoyad").value.trim();
    const email = document.getElementById("email").value.trim();
    const telefon = document.getElementById("telefon").value.trim();
    const sifre = document.getElementById("sifre").value;

    // Validasyon
    if (!adSoyad || !email || !sifre) {
      showAlert("Lütfen zorunlu alanları doldurunuz.", "error");
      return;
    }

    if (sifre.length < 6) {
      showAlert("Şifre en az 6 karakter olmalıdır.", "error");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert("Geçerli bir e-posta adresi giriniz.", "error");
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = "Ekleniyor...";
    submitBtn.disabled = true;

    try {
      // Email kontrolü - sistemde var mı? (Tüm kullanıcıları çek)
      let allUsers = [];
      try {
        allUsers = await API.get("/Kullanici");
        if (!Array.isArray(allUsers)) {
          allUsers = [];
        }
      } catch (err) {
        console.warn("Kullanıcılar çekilemedi, email kontrolü atlanıyor:", err);
        allUsers = [];
      }

      const emailExists = allUsers.some(u => {
        const userEmail = (u.email || u.Email || "").toLowerCase();
        return userEmail === email.toLowerCase();
      });
      
      if (emailExists) {
        showAlert("Bu e-posta adresi zaten sistemde kayıtlı.", "error");
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
        return;
      }

      // Önce kullanıcıyı oluştur (rol olmadan veya Tenant olarak)
      const registerData = {
        adSoyad: adSoyad,
        email: email,
        telefon: telefon || null,
        sifre: sifre,
        rol: "Tenant" // Geçici olarak Tenant, sonra Admin rolü atanacak
      };

      console.log("Kullanıcı kaydı oluşturuluyor:", registerData);
      const registerResult = await API.post("/Kullanici/register", registerData);

      if (registerResult === null || registerResult === undefined) {
        throw new Error("Kullanıcı kaydı oluşturulamadı.");
      }

      // Kullanıcı ID'sini al
      let newUserId = registerResult.kullaniciID || registerResult.KullaniciID || registerResult.id || registerResult.ID;
      
      // Eğer ID gelmediyse, email ile kullanıcıyı bul (tüm kullanıcıları tekrar çek)
      if (!newUserId) {
        console.log("Register sonucunda ID gelmedi, kullanıcı email ile aranıyor...");
        const updatedUsers = await API.get("/Kullanici");
        if (Array.isArray(updatedUsers)) {
          const foundUser = updatedUsers.find(u => {
            const userEmail = (u.email || u.Email || "").toLowerCase();
            return userEmail === email.toLowerCase();
          });
          
          if (foundUser) {
            newUserId = foundUser.kullaniciID || foundUser.KullaniciID || foundUser.id || foundUser.ID;
            console.log("Kullanıcı email ile bulundu, ID:", newUserId);
          }
        }
      }

      if (!newUserId) {
        throw new Error("Kullanıcı oluşturuldu ancak ID alınamadı. Lütfen tekrar deneyin.");
      }

      // Admin rolünü ata
      console.log("Admin rolü atanıyor, kullanıcı ID:", newUserId);
      await assignAdminRole(newUserId);

      showAlert("Admin başarıyla eklendi!", "success");
      document.getElementById("adminForm").reset();
      
      // 2 saniye sonra kullanıcılar sayfasına yönlendir
      setTimeout(() => {
        window.location.href = "kullanicilar.html";
      }, 2000);
    } catch (error) {
      console.error("Admin ekleme hatası:", error);
      const errorMsg = error.message || "Admin eklenirken bir hata oluştu.";
      
      // Backend'den gelen hata mesajını kontrol et
      if (errorMsg.includes("rol") || errorMsg.includes("Rol") || errorMsg.includes("role")) {
        showAlert("Hata: Geçersiz rol seçimi. Lütfen tekrar deneyin.", "error");
      } else {
        showAlert("Hata: " + errorMsg, "error");
      }
    } finally {
      submitBtn.innerText = originalText;
      submitBtn.disabled = false;
    }
  });
});

// Admin rolünü atama fonksiyonu
async function assignAdminRole(userId) {
  try {
    // Önce rol listesini çek
    const roles = await API.get("/Rol");
    if (!Array.isArray(roles)) {
      throw new Error("Rol listesi alınamadı.");
    }

    // Admin rolünü bul
    const adminRole = roles.find(r => {
      const rolAdi = (r.rolAdi || r.RolAdi || "").toLowerCase();
      return rolAdi === "admin";
    });

    if (!adminRole) {
      throw new Error("Admin rolü bulunamadı.");
    }

    const adminRoleId = adminRole.rolID || adminRole.RolID || adminRole.id || adminRole.ID;
    if (!adminRoleId) {
      throw new Error("Admin rol ID'si bulunamadı.");
    }

    // Kullanıcıya Admin rolünü ata
    const roleData = {
      kullaniciID: userId,
      rolID: adminRoleId
    };

    console.log("Admin rolü atanıyor:", roleData);
    await API.post("/KullaniciRol/assign", roleData);
    console.log("Admin rolü başarıyla atandı.");
  } catch (error) {
    console.error("Rol atama hatası:", error);
    throw new Error("Admin rolü atanamadı: " + (error.message || "Bilinmeyen hata"));
  }
}

// Alert Göster
function showAlert(message, type) {
  const alertEl = document.getElementById("alertMessage");
  alertEl.className = `alert alert-${type}`;
  alertEl.innerText = message;
  alertEl.style.display = "block";

  setTimeout(() => {
    alertEl.style.display = "none";
  }, 5000);
}

// Çıkış
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});

