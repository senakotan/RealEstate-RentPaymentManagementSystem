document.addEventListener("DOMContentLoaded", () => {
  // Kayıt Formunu Dinle
  const registerForm = document.getElementById("registerForm");

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault(); // Sayfanın yenilenmesini engelle

      // 1. Form Verilerini Topla
      const adSoyad = document.getElementById("regAd").value.trim();
      const email = document.getElementById("regEmail").value.trim();
      const telefon = document.getElementById("regTel").value.trim();
      const sifre = document.getElementById("regPass").value;

      // Seçili Rolü Bul (Radio Button)
      const selectedRoleElement = document.querySelector(
        'input[name="role"]:checked'
      );
      const rol = selectedRoleElement ? selectedRoleElement.value : "Owner"; // Varsayılan Owner

      // Basit Validasyon
      if (!adSoyad || !email || !sifre) {
        alert("Lütfen zorunlu alanları doldurunuz.");
        return;
      }

      // Email format kontrolü
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        alert("Lütfen geçerli bir e-posta adresi giriniz.");
        return;
      }

      // Şifre uzunluk kontrolü
      if (sifre.length < 6) {
        alert("Şifre en az 6 karakter olmalıdır.");
        return;
      }

      // 2. Backend'e Gönderilecek Veri Paketi
      // Backend'deki RegisterDto ile birebir aynı isimde olmalı property'ler
      const data = {
        adSoyad: adSoyad,
        email: email,
        telefon: telefon,
        sifre: sifre, // Backend'de 'Sifre' bekliyor
        rol: rol, // 'Owner' veya 'Tenant'
      };

      // 3. API İsteği (POST)
      const submitBtn = registerForm.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.innerText : "Kayıt Ol";
      
      if (submitBtn) {
        submitBtn.innerText = "Kaydediliyor...";
        submitBtn.disabled = true;
      }

      try {
        // api.js dosyasındaki API.post metodunu kullanıyoruz
        const result = await API.post("/Kullanici/register", data);

        if (result) {
          // Admin'e bildirim gönder
          try {
            await Notifications.newUserRegistered(adSoyad, rol);
          } catch (notifError) {
            // Sessiz hata yönetimi
          }
          
          alert("Kayıt Başarılı! Giriş sayfasına yönlendiriliyorsunuz.");
          window.location.href = "index.html";
        }
      } catch (error) {
        // Backend'den gelen hata mesajını göster
        const errorMsg = error.message || "Kayıt işlemi başarısız oldu. Lütfen tekrar deneyin.";
        
        // Hata mesajını göster
        alert("Hata: " + errorMsg);
        
        console.error("Kayıt hatası:", error);
      } finally {
        // Butonu eski haline getir
        if (submitBtn) {
          submitBtn.innerText = originalText;
          submitBtn.disabled = false;
        }
      }
    });
  }
});
