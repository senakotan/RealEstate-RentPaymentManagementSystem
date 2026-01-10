document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  
  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault(); // Sayfanın yenilenmesini engelle

      const email = document.getElementById("email").value.trim();
      const sifre = document.getElementById("password").value;

      // Basit Validasyon
      if (!email || !sifre) {
        alert("Lütfen e-posta ve şifre giriniz.");
        return;
      }

      // Email format kontrolü
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        alert("Lütfen geçerli bir e-posta adresi giriniz.");
        return;
      }

      // Backend'e gönderilecek veri
      const loginData = {
        email: email,
        sifre: sifre,
      };

      // Butonu disable et
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.innerText : "";
      if (submitBtn) {
        submitBtn.innerText = "Giriş yapılıyor...";
        submitBtn.disabled = true;
      }

      // Hata mesajı alanını gizle
      const errorMessage = document.getElementById("errorMessage");
      if (errorMessage) {
        errorMessage.style.display = "none";
        errorMessage.innerText = "";
      }

      try {
        // api.js dosyasındaki API.post metodunu kullanıyoruz
        const result = await API.post("/login", loginData);

        if (result && result.user) {
          // Giriş Başarılı!
          // Kullanıcı bilgilerini tarayıcı hafızasına (LocalStorage) kaydet
          localStorage.setItem("user", JSON.stringify(result.user));

          // ROL KONTROLÜ VE YÖNLENDİRME
          // Backend cevabında Rol: "Owner", "Tenant" veya "Admin" geliyor olmalı
          if (result.user.rol === "Owner") {
            window.location.href = "owner/dashboard.html";
          } else if (result.user.rol === "Tenant") {
            window.location.href = "tenant/dashboard.html";
          } else if (result.user.rol === "Admin") {
            window.location.href = "admin/dashboard.html";
          } else {
            showError("Rolünüz tanımlanmamış, Admin ile görüşün.");
          }
        } else {
          // Giriş başarısız - kullanıcı bilgisi gelmedi
          showError("E-posta veya şifre hatalı. Lütfen tekrar deneyin.");
        }
      } catch (error) {
        // Hata mesajını göster
        let errorMsg = "E-posta veya şifre hatalı. Lütfen tekrar deneyin.";
        if (error.message) {
          errorMsg = error.message;
        } else if (error.title) {
          errorMsg = error.title;
        }
        showError(errorMsg);
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

// Hata mesajı göster
function showError(message) {
  const errorMessage = document.getElementById("errorMessage");
  if (errorMessage) {
    errorMessage.innerText = message;
    errorMessage.style.display = "block";
    
    // 5 saniye sonra otomatik gizle
    setTimeout(() => {
      errorMessage.style.display = "none";
    }, 5000);
  } else {
    // Fallback: alert kullan
    alert(message);
  }
}
