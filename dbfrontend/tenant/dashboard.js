document.addEventListener("DOMContentLoaded", async () => {
  // 1. Yetki Kontrolü
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }
  const user = JSON.parse(userStr);

  // Rol Kontrolü: Sadece Tenant girebilir
  if (user.rol !== "Tenant") {
    alert("Bu panele sadece kiracılar girebilir!");
    window.location.href = "../index.html";
    return;
  }

  // Profil Bilgilerini Doldur
  document.getElementById("headerUserName").innerText = user.adSoyad;
  // Kiracı için farklı bir avatar rengi (Mor)
  document.getElementById(
    "userImg"
  ).src = `https://ui-avatars.com/api/?name=${user.adSoyad}&background=764ba2&color=fff`;

  // 2. Dashboard Verilerini Çek
  try {
    const dashboardData = await API.get(`/Dashboard/tenant/${user.kullaniciID}`);
    
    if (dashboardData && dashboardData.aktifSozlesme) {
      const contract = dashboardData.aktifSozlesme;
      
      // --- KARTLARI DOLDUR ---
      // Kira Tutarı
      document.getElementById("kiraTutari").innerText = 
        `${contract.aylikKiraTutar || contract.AylikKiraTutar} ${contract.paraBirimiKod || contract.ParaBirimiKod || "TRY"}`;

      // Ev Sahibi Adı
      document.getElementById("evSahibi").innerText = 
        contract.sahipAd || contract.SahipAd || "-";

      // Sonraki Ödeme Tarihi Hesaplama
      const bugun = new Date();
      let odemeAy = bugun.getMonth() + 1;
      let odemeYil = bugun.getFullYear();
      const odemeGunu = contract.odemeGunu || contract.OdemeGunu || 1;

      if (bugun.getDate() > odemeGunu) {
        odemeAy++;
        if (odemeAy > 12) {
          odemeAy = 1;
          odemeYil++;
        }
      }

      document.getElementById("sonrakiOdeme").innerText = 
        `${odemeGunu}.${odemeAy}.${odemeYil}`;

      // Kalan Gün Hesaplama
      const bitisTarihi = contract.bitisTarihi || contract.BitisTarihi;
      if (bitisTarihi) {
        const bitis = new Date(bitisTarihi);
        const fark = Math.ceil((bitis - bugun) / (1000 * 60 * 60 * 24));
        document.getElementById("kalanGun").innerText =
          fark > 0 ? `${fark} Gün` : "Süre Doldu";
      } else {
        document.getElementById("kalanGun").innerText = "Süresiz";
      }

      // --- EV DETAYLARI ---
      document.getElementById("mulkBaslik").innerText = 
        contract.mulkBaslik || contract.MulkBaslik || "-";
      document.getElementById("mulkAdres").innerHTML = 
        `<i class="fa-solid fa-location-dot"></i> ${contract.mulkAdres || contract.MulkAdres || "-"}`;
      
      document.getElementById("mulkDetay").innerText = 
        `Sözleşme No: ${contract.sozlesmeNo || contract.SozlesmeNo || "-"}`;
      
      // Bekleyen Ödemeler
      const bekleyenOdemeler = dashboardData.bekleyenOdemeler || dashboardData.BekleyenOdemeler || [];
      if (bekleyenOdemeler.length > 0) {
        const bekleyenEl = document.getElementById("bekleyenOdemeler");
        if (bekleyenEl) {
          bekleyenEl.innerText = `${bekleyenOdemeler.length} ödeme bekliyor`;
        }
      }
    } else {
      // Fallback: Eski yöntem
      const contracts = await API.get(`/KiraSozlesme?userId=${user.kullaniciID}&role=Tenant`);
      
      if (contracts && contracts.length > 0) {
        const activeContract = contracts.find((c) => c.aktifMi) || contracts[0];
        
        if (activeContract) {
          document.getElementById("kiraTutari").innerText = 
            `${activeContract.aylikKiraTutar} ${activeContract.paraBirimiKod}`;
          document.getElementById("evSahibi").innerText = activeContract.mulkSahibiAd;
          
          const bugun = new Date();
          let odemeAy = bugun.getMonth() + 1;
          let odemeYil = bugun.getFullYear();
          if (bugun.getDate() > activeContract.odemeGunu) {
            odemeAy++;
            if (odemeAy > 12) {
              odemeAy = 1;
              odemeYil++;
            }
          }
          document.getElementById("sonrakiOdeme").innerText = 
            `${activeContract.odemeGunu}.${odemeAy}.${odemeYil}`;
          
          if (activeContract.bitisTarihi) {
            const bitis = new Date(activeContract.bitisTarihi);
            const fark = Math.ceil((bitis - bugun) / (1000 * 60 * 60 * 24));
            document.getElementById("kalanGun").innerText =
              fark > 0 ? `${fark} Gün` : "Süre Doldu";
          } else {
            document.getElementById("kalanGun").innerText = "Süresiz";
          }
          
          document.getElementById("mulkBaslik").innerText = activeContract.mulkBaslik;
          document.getElementById("mulkAdres").innerHTML = 
            `<i class="fa-solid fa-location-dot"></i> ${activeContract.mulkAdres}`;
          document.getElementById("mulkDetay").innerText = 
            `Sözleşme No: ${activeContract.sozlesmeNo}`;
        }
      } else {
        document.getElementById("mulkBaslik").innerText = "Aktif Sözleşme Yok";
        document.getElementById("mulkAdres").innerText = "Sisteme kayıtlı bir eviniz görünmüyor.";
      }
    }
  } catch (error) {
    console.error("Veri hatası:", error);
    document.getElementById("mulkBaslik").innerText = "Veri Yüklenemedi";
  }
});

// Çıkış Butonu
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});
