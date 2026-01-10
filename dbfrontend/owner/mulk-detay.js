let currentMulkId = null;
let paraBirimleri = [];

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Yetki Kontrolü
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }

  const user = JSON.parse(userStr);
  if (user.rol !== "Owner") {
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

  // 3. Para birimlerini yükle
  try {
    const sozluk = await API.get("/sozluk/all");
    if (sozluk && sozluk.ParaBirimi) {
      paraBirimleri = sozluk.ParaBirimi;
      const select = document.getElementById("valuationCurrency");
      select.innerHTML = '<option value="">Seçiniz...</option>';
      paraBirimleri.forEach(pb => {
        const opt = document.createElement("option");
        opt.value = pb.ParaBirimiID || pb.paraBirimiID;
        opt.text = `${pb.Kod || pb.kod} - ${pb.Ad || pb.ad}`;
        select.appendChild(opt);
      });
    }
  } catch (e) {
    console.error("Para birimi yükleme hatası:", e);
  }

  // 4. Mülk bilgilerini yükle
  await loadPropertyDetails();
  
  // 5. Görselleri yükle
  await loadImages();
  
  // 6. Belgeleri yükle
  await loadDocuments();
  
  // 7. Değerlemeleri yükle
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
        // Dosya yolu /uploads ile başlıyorsa BASE_URL ekle
        let imageUrl = img.dosyaYolu || img.DosyaYolu;
        if (imageUrl && imageUrl.startsWith("/uploads/")) {
          imageUrl = "https://localhost:7288" + imageUrl;
        }
        const imageId = img.mulkGorselID || img.MulkGorselID;
        if (!imageId) {
          console.error("Görsel ID bulunamadı:", img);
          return;
        }
        item.innerHTML = `
          <img src="${imageUrl}" alt="${img.aciklama || img.Aciklama || 'Görsel'}" 
               onerror="this.src='https://via.placeholder.com/300x200?text=Görsel+Yüklenemedi'">
          <button class="delete-btn" onclick="deleteImage(${imageId})" title="Sil">
            <i class="fa-solid fa-trash"></i>
          </button>
        `;
        galleryGrid.appendChild(item);
      });
    } else {
      galleryGrid.innerHTML = '<p style="color:#8d97ad; text-align:center; grid-column:1/-1; padding:2rem;">Henüz görsel eklenmemiş.</p>';
    }
  } catch (error) {
    console.error("Görsel yükleme hatası:", error);
    galleryGrid.innerHTML = '<p style="color:#ff4b5c; text-align:center; grid-column:1/-1; padding:2rem;">Görseller yüklenirken hata oluştu.</p>';
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
        // Dosya yolu /uploads ile başlıyorsa BASE_URL ekle
        let docUrl = doc.dosyaYolu || doc.DosyaYolu;
        if (docUrl && docUrl.startsWith("/uploads/")) {
          docUrl = "https://localhost:7288" + docUrl;
        }
        const docId = doc.mulkBelgeID || doc.MulkBelgeID;
        if (!docId) {
          console.error("Belge ID bulunamadı:", doc);
          return;
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
          <button class="action-btn btn-delete" onclick="deleteDocument(${docId})" title="Sil">
            <i class="fa-solid fa-trash"></i>
          </button>
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
        const valId = val.mulkDegerlemeID || val.MulkDegerlemeID;
        if (!valId) {
          console.error("Değerleme ID bulunamadı:", val);
          return;
        }
        row.innerHTML = `
          <td>${val.degerTarihi || val.DegerTarihi}</td>
          <td><strong>${formatCurrency(val.tahminiDeger || val.TahminiDeger)} ${val.paraBirimiKod || val.ParaBirimiKod || 'TL'}</strong></td>
          <td>${val.kaynak || val.Kaynak || '-'}</td>
          <td>${val.aciklama || val.Aciklama || '-'}</td>
          <td>
            <button class="action-btn btn-delete" onclick="deleteValuation(${valId})" title="Sil">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        `;
        tableBody.appendChild(row);
      });
    } else {
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#8d97ad; padding:2rem;">Henüz değerleme kaydı yok.</td></tr>';
    }
  } catch (error) {
    console.error("Değerleme yükleme hatası:", error);
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ff4b5c; padding:2rem;">Değerlemeler yüklenirken hata oluştu.</td></tr>';
  }
}

// Form Toggle Fonksiyonları
window.toggleImageForm = function() {
  const form = document.getElementById("addImageForm");
  form.style.display = form.style.display === "none" ? "block" : "none";
};

window.toggleDocumentForm = function() {
  const form = document.getElementById("addDocumentForm");
  form.style.display = form.style.display === "none" ? "block" : "none";
};

window.toggleValuationForm = function() {
  const form = document.getElementById("addValuationForm");
  form.style.display = form.style.display === "none" ? "block" : "none";
};

// Görsel Ekle
window.addImage = async function() {
  const fileInput = document.getElementById("imageFile");
  const file = fileInput.files[0];
  const description = document.getElementById("imageDescription").value.trim();
  
  if (!file) {
    alert("Lütfen bir görsel dosyası seçin.");
    return;
  }
  
  // Dosya boyutu kontrolü (10MB)
  if (file.size > 10 * 1024 * 1024) {
    alert("Dosya boyutu 10MB'dan küçük olmalıdır.");
    return;
  }
  
  const btn = document.getElementById("btnAddImage");
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...';
  
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mulkID", currentMulkId);
    if (description) {
      formData.append("aciklama", description);
    }
    
    const result = await API.upload("/MulkGorsel/upload", formData);
    
    if (result) {
      alert("Görsel başarıyla yüklendi!");
      fileInput.value = "";
      document.getElementById("imageDescription").value = "";
      document.getElementById("addImageForm").style.display = "none";
      await loadImages();
    }
  } catch (error) {
    alert("Görsel yüklenirken hata oluştu: " + (error.message || "Bilinmeyen hata"));
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
};

// Belge Ekle
window.addDocument = async function() {
  const type = document.getElementById("documentType").value;
  const fileInput = document.getElementById("documentFile");
  const file = fileInput.files[0];
  const description = document.getElementById("documentDescription").value.trim();
  
  if (!type) {
    alert("Lütfen belge türü seçin.");
    return;
  }
  
  if (!file) {
    alert("Lütfen bir belge dosyası seçin.");
    return;
  }
  
  // Dosya boyutu kontrolü (20MB)
  if (file.size > 20 * 1024 * 1024) {
    alert("Dosya boyutu 20MB'dan küçük olmalıdır.");
    return;
  }
  
  const btn = document.getElementById("btnAddDocument");
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...';
  
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mulkID", currentMulkId);
    formData.append("belgeTuru", type);
    if (description) {
      formData.append("aciklama", description);
    }
    
    const result = await API.upload("/MulkBelge/upload", formData);
    
    if (result) {
      alert("Belge başarıyla yüklendi!");
      fileInput.value = "";
      document.getElementById("documentDescription").value = "";
      document.getElementById("addDocumentForm").style.display = "none";
      await loadDocuments();
    }
  } catch (error) {
    alert("Belge yüklenirken hata oluştu: " + (error.message || "Bilinmeyen hata"));
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
};

// Değerleme Ekle
window.addValuation = async function() {
  const date = document.getElementById("valuationDate").value;
  const amount = document.getElementById("valuationAmount").value;
  const currencyId = document.getElementById("valuationCurrency").value;
  const source = document.getElementById("valuationSource").value.trim();
  const description = document.getElementById("valuationDescription").value.trim();
  
  if (!date || !amount || !currencyId) {
    alert("Tarih, tutar ve para birimi zorunludur.");
    return;
  }
  
  try {
    const result = await API.post("/MulkDegerleme", {
      mulkID: parseInt(currentMulkId),
      degerTarihi: date,
      tahminiDeger: parseFloat(amount),
      paraBirimiID: parseInt(currencyId),
      kaynak: source || null,
      aciklama: description || null
    });
    
    if (result) {
      alert("Değerleme başarıyla eklendi!");
      document.getElementById("valuationDate").value = "";
      document.getElementById("valuationAmount").value = "";
      document.getElementById("valuationCurrency").value = "";
      document.getElementById("valuationSource").value = "";
      document.getElementById("valuationDescription").value = "";
      document.getElementById("addValuationForm").style.display = "none";
      await loadValuations();
    }
  } catch (error) {
    alert("Değerleme eklenirken hata oluştu: " + (error.message || "Bilinmeyen hata"));
  }
};

// Görsel Sil
window.deleteImage = async function(id) {
  if (!id || id === 'undefined') {
    console.error("Geçersiz görsel ID:", id);
    alert("Görsel ID bulunamadı!");
    return;
  }
  
  if (!confirm("Bu görseli silmek istediğinize emin misiniz?")) {
    return;
  }
  
  try {
    const result = await API.delete(`/MulkGorsel/${id}`);
    if (result) {
      alert("Görsel silindi!");
      await loadImages();
    }
  } catch (error) {
    alert("Görsel silinirken hata oluştu: " + (error.message || "Bilinmeyen hata"));
  }
};

// Belge Sil
window.deleteDocument = async function(id) {
  if (!id || id === 'undefined') {
    console.error("Geçersiz belge ID:", id);
    alert("Belge ID bulunamadı!");
    return;
  }
  
  if (!confirm("Bu belgeyi silmek istediğinize emin misiniz?")) {
    return;
  }
  
  try {
    const result = await API.delete(`/MulkBelge/${id}`);
    if (result) {
      alert("Belge silindi!");
      await loadDocuments();
    }
  } catch (error) {
    alert("Belge silinirken hata oluştu: " + (error.message || "Bilinmeyen hata"));
  }
};

// Değerleme Sil
window.deleteValuation = async function(id) {
  if (!id || id === 'undefined') {
    console.error("Geçersiz değerleme ID:", id);
    alert("Değerleme ID bulunamadı!");
    return;
  }
  
  if (!confirm("Bu değerleme kaydını silmek istediğinize emin misiniz?")) {
    return;
  }
  
  try {
    const result = await API.delete(`/MulkDegerleme/${id}`);
    if (result) {
      alert("Değerleme kaydı silindi!");
      await loadValuations();
    }
  } catch (error) {
    alert("Değerleme silinirken hata oluştu: " + (error.message || "Bilinmeyen hata"));
  }
};

// Para birimi formatla
function formatCurrency(amount) {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

