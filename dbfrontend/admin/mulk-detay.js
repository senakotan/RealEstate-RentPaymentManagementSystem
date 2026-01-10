let currentMulkId = null;

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Yetki Kontrolü
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }

  const user = JSON.parse(userStr);
  if (user.rol !== "Admin") {
    alert("Yetkisiz Giriş!");
    window.location.href = "../index.html";
    return;
  }

  // 2. URL'den Mülk ID'sini al
  const urlParams = new URLSearchParams(window.location.search);
  currentMulkId = urlParams.get("id");

  if (!currentMulkId) {
    alert("Mülk ID bulunamadı!");
    window.location.href = "mulkler.html";
    return;
  }

  // 3. Mülk bilgilerini yükle
  await loadPropertyDetails();
  
  // 4. Görselleri yükle
  await loadImages();
  
  // 5. Belgeleri yükle
  await loadDocuments();
  
  // 6. Değerlemeleri yükle
  await loadValuations();
});

// Mülk Detaylarını Yükle
async function loadPropertyDetails() {
  try {
    const mulk = await API.get(`/Mulk/${currentMulkId}`);
    
    if (mulk) {
      document.getElementById("propertyTitle").textContent = mulk.baslik || mulk.Baslik || "Mülk Detayı";
      document.getElementById("infoBaslik").textContent = mulk.baslik || mulk.Baslik || "-";
      document.getElementById("infoAdres").textContent = mulk.adres || mulk.Adres || "-";
      document.getElementById("infoKonum").textContent = `${mulk.ilceAd || mulk.IlceAd || "-"} / ${mulk.sehirAd || mulk.SehirAd || "-"}`;
      document.getElementById("infoMetrekare").textContent = `${mulk.metrekare || mulk.Metrekare || 0} m²`;
      document.getElementById("infoOda").textContent = mulk.odaSayisi || mulk.OdaSayisi || "-";
      document.getElementById("infoTur").textContent = mulk.mulkTuruAd || mulk.MulkTuruAd || "-";
      document.getElementById("infoSahip").textContent = mulk.sahipAdSoyad || mulk.SahipAdSoyad || "-";
      
      const aktifMi = mulk.aktifMi !== undefined ? mulk.aktifMi : mulk.AktifMi;
      const durumText = aktifMi ? "Aktif" : "Pasif";
      const durumColor = aktifMi ? "#00c853" : "#ff4b5c";
      document.getElementById("infoDurum").innerHTML = `<span style="color:${durumColor};">${durumText}</span>`;
    }
  } catch (error) {
    console.error("Mülk detay yükleme hatası:", error);
    alert("Mülk bilgileri yüklenirken hata oluştu.");
  }
}

// Görselleri Yükle
async function loadImages() {
  const galleryGrid = document.getElementById("galleryGrid");
  try {
    const images = await API.get(`/MulkGorsel/mulk/${currentMulkId}`);
    galleryGrid.innerHTML = "";
    if (images && images.length > 0) {
      images.forEach(img => {
        const item = document.createElement("div");
        item.className = "gallery-item";
        let imageUrl = img.dosyaYolu || img.DosyaYolu;
        if (imageUrl && imageUrl.startsWith("/uploads/")) {
          imageUrl = "https://localhost:7288" + imageUrl;
        }
        item.innerHTML = `
          <img src="${imageUrl}" alt="${img.aciklama || img.Aciklama || 'Görsel'}" 
               onerror="this.src='https://via.placeholder.com/300x200?text=Görsel+Yüklenemedi'">
        `;
        galleryGrid.appendChild(item);
      });
    } else {
      galleryGrid.innerHTML = '<p style="text-align:center; color:#8d97ad; padding:1rem; grid-column:1/-1;">Henüz görsel bulunmuyor.</p>';
    }
  } catch (error) {
    console.error("Görsel yükleme hatası:", error);
    galleryGrid.innerHTML = '<p style="text-align:center; color:#ff4b5c; padding:1rem; grid-column:1/-1;">Görseller yüklenirken hata oluştu.</p>';
  }
}

// Belgeleri Yükle
async function loadDocuments() {
  const documentList = document.getElementById("documentList");
  
  try {
    const documents = await API.get(`/MulkBelge/mulk/${currentMulkId}`);
    
    documentList.innerHTML = "";
    
    if (documents && documents.length > 0) {
      documents.forEach(doc => {
        const item = document.createElement("li");
        item.className = "document-item";
        let docUrl = doc.dosyaYolu || doc.DosyaYolu;
        if (docUrl && docUrl.startsWith("/uploads/")) {
          docUrl = "https://localhost:7288" + docUrl;
        }
        item.innerHTML = `
          <div>
            <a href="${docUrl}" target="_blank">
              <i class="fa-solid fa-file-pdf"></i>
              <strong>${doc.belgeTuru || doc.BelgeTuru}</strong>
              ${doc.aciklama || doc.Aciklama ? ` - ${doc.aciklama || doc.Aciklama}` : ''}
            </a>
            <small style="color:#8d97ad; margin-left:10px;">${doc.yuklemeTarihi || doc.YuklemeTarihi}</small>
          </div>
        `;
        documentList.appendChild(item);
      });
    } else {
      documentList.innerHTML = '<li style="color:#8d97ad; text-align:center; padding:2rem;">Henüz belge eklenmemiş.</li>';
    }
  } catch (error) {
    console.error("Belge yükleme hatası:", error);
    documentList.innerHTML = '<li style="color:#ff4b5c; text-align:center; padding:2rem;">Belgeler yüklenirken hata oluştu.</li>';
  }
}

// Değerlemeleri Yükle
async function loadValuations() {
  const tableBody = document.getElementById("valuationTableBody");
  
  try {
    const valuations = await API.get(`/MulkDegerleme/mulk/${currentMulkId}`);
    
    tableBody.innerHTML = "";
    
    if (valuations && valuations.length > 0) {
      valuations.forEach(val => {
        const row = document.createElement("tr");
        const tarih = val.degerTarihi || val.DegerTarihi || "-";
        const deger = val.tahminiDeger || val.TahminiDeger || 0;
        const paraBirimi = val.paraBirimiKod || val.ParaBirimiKod || "TRY";
        const kaynak = val.kaynak || val.Kaynak || "-";
        const aciklama = val.aciklama || val.Aciklama || "-";
        
        row.innerHTML = `
          <td>${tarih}</td>
          <td>${parseFloat(deger).toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${paraBirimi}</td>
          <td>${kaynak}</td>
          <td>${aciklama}</td>
        `;
        tableBody.appendChild(row);
      });
    } else {
      tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#8d97ad; padding:1rem;">Henüz değerleme kaydı bulunmuyor.</td></tr>';
    }
  } catch (error) {
    console.error("Değerleme yükleme hatası:", error);
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#ff4b5c; padding:1rem;">Değerlemeler yüklenirken hata oluştu.</td></tr>';
  }
}

// Çıkış
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});


