let globalTenants = [];
let filteredTenants = [];

document.addEventListener("DOMContentLoaded", async () => {
  // Yetki Kontrolü
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }
  const user = JSON.parse(userStr);
  if (user.rol !== "Admin") {
    alert("Bu sayfaya erişim yetkiniz yok.");
    window.location.href = "../index.html";
    return;
  }

  await loadTenants();
});

// Kiracıları Listele
async function loadTenants() {
  const tableBody = document.getElementById("tenantList");
  tableBody.innerHTML =
    "<tr><td colspan='6' style='text-align:center; color:#888;'>Yükleniyor...</td></tr>";

  try {
    // Backend: Tüm kiracıları getir
    const tenants = await API.get("/Kiraci");

    globalTenants = tenants || [];
    filteredTenants = [...globalTenants];

    renderTenants();
  } catch (error) {
    tableBody.innerHTML =
      "<tr><td colspan='6' style='color:red; text-align:center;'>Veri yüklenirken hata oluştu.</td></tr>";
  }
}

// Kiracıları Render Et
function renderTenants() {
  const tableBody = document.getElementById("tenantList");
  tableBody.innerHTML = "";

  if (filteredTenants.length > 0) {
    filteredTenants.forEach((t) => {
      const id = t.kiraciID || t.KiraciID;
      const ad = t.adSoyad || t.AdSoyad;
      const email = t.email || t.Email || "-";
      const tel = t.telefon || t.Telefon || "-";
      const tc = t.tcNo || t.TCNo || "-";
      const aktifMi = t.aktifMi !== undefined ? t.aktifMi : t.AktifMi;

      // İsim baş harfleri (Avatar için)
      const initials = ad
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);

      // Durum Rozeti
      const statusBadge = aktifMi
        ? `<span style="background:rgba(0,200,83,0.2); color:#00c853; padding:4px 10px; border-radius:15px; font-size:0.75rem;">Aktif</span>`
        : `<span style="background:rgba(255,75,92,0.2); color:#ff4b5c; padding:4px 10px; border-radius:15px; font-size:0.75rem;">Pasif</span>`;

      const row = `
                    <tr>
                        <td>
                            <div class="tenant-profile">
                                <div class="avatar-initial">${initials}</div>
                                <span style="font-weight:500;">${ad}</span>
                            </div>
                        </td>
                        <td>
                            <div style="font-size:0.9rem;">${email}</div>
                        </td>
                        <td>${tel}</td>
                        <td>${tc}</td>
                        <td>${statusBadge}</td>
                        <td>
                            <button class="action-btn btn-edit" title="Detay" onclick="viewTenantDetail(${id})">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                        </td>
                    </tr>
                `;
      tableBody.innerHTML += row;
    });
  } else {
    tableBody.innerHTML =
      "<tr><td colspan='6' style='text-align:center; padding:2rem; color:#888;'>Henüz kayıtlı kiracı bulunmuyor.</td></tr>";
  }
}

// Arama Fonksiyonu
window.filterTenants = function() {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase().trim();
  
  if (!searchTerm) {
    filteredTenants = [...globalTenants];
  } else {
    filteredTenants = globalTenants.filter(t => {
      const adSoyad = (t.adSoyad || t.AdSoyad || "").toLowerCase();
      const email = (t.email || t.Email || "").toLowerCase();
      return adSoyad.includes(searchTerm) || email.includes(searchTerm);
    });
  }
  
  renderTenants();
};

// Kiracı Detayı
window.viewTenantDetail = async function(id) {
  const modal = document.getElementById("tenantDetailModal");
  modal.style.display = "block";

  // Kiracı bilgilerini yükle
  await loadTenantDetails(id);
};

// Modal'ı Kapat
window.closeTenantDetailModal = function() {
  const modal = document.getElementById("tenantDetailModal");
  modal.style.display = "none";
};

// Modal dışına tıklanınca kapat
document.addEventListener("click", function(event) {
  const modal = document.getElementById("tenantDetailModal");
  if (event.target === modal) {
    modal.style.display = "none";
  }
});

// Kiracı Detaylarını Yükle
async function loadTenantDetails(kiraciID) {
  try {
    // Kiracı bilgilerini çek
    const tenants = await API.get("/Kiraci");
    const tenant = tenants?.find(t => (t.kiraciID || t.KiraciID) == kiraciID);

    if (!tenant) {
      alert("Kiracı bulunamadı.");
      return;
    }

    // Kişisel Bilgiler
    const adSoyad = tenant.adSoyad || tenant.AdSoyad || "-";
    const email = tenant.email || tenant.Email || "-";
    const telefon = tenant.telefon || tenant.Telefon || "-";
    const tcNo = tenant.tcNo || tenant.TCNo || "-";
    const adres = tenant.adres || tenant.Adres || "-";
    const aktifMi = tenant.aktifMi !== undefined ? tenant.aktifMi : tenant.AktifMi;

    document.getElementById("modalTenantName").innerText = adSoyad;
    document.getElementById("detailAdSoyad").innerText = adSoyad;
    document.getElementById("detailEmail").innerText = email;
    document.getElementById("detailTelefon").innerText = telefon;
    document.getElementById("detailTC").innerText = tcNo;
    document.getElementById("detailAdres").innerText = adres || "Belirtilmemiş";
    
    const durumBadge = aktifMi 
      ? '<span class="status-badge status-active">Aktif</span>'
      : '<span class="status-badge status-late">Pasif</span>';
    document.getElementById("detailDurum").innerHTML = durumBadge;

    // Kiracının KullaniciID'sini bul
    let tenantKullaniciID = null;
    try {
      const allUsers = await API.get("/Kullanici");
      if (Array.isArray(allUsers)) {
        // Email ile eşleştir
        const user = allUsers.find(u => {
          const userEmail = (u.email || u.Email || "").toLowerCase();
          return userEmail === email.toLowerCase();
        });
        if (user) {
          tenantKullaniciID = user.kullaniciID || user.KullaniciID || user.id || user.ID;
        }
      }
    } catch (userError) {
      // Kullanıcı ID bulunamadı
    }

    // Aktif Sözleşmeler
    await loadTenantContracts(kiraciID);

    // Ödeme Geçmişi
    await loadTenantPayments(kiraciID, tenantKullaniciID);

    // Bakım Talepleri
    await loadTenantMaintenance(kiraciID);
  } catch (error) {
    alert("Kiracı detayları yüklenirken bir hata oluştu.");
  }
}

// Kiracının Sözleşmelerini Yükle
async function loadTenantContracts(kiraciID) {
  const container = document.getElementById("detailContracts");
  container.innerHTML = "<p style='color: #8d97ad; text-align: center; padding: 1rem;'>Yükleniyor...</p>";

  try {
    // Önce tüm sözleşmeleri çek
    let contracts = await API.get("/KiraSozlesme");
    
    // Eğer boşsa, alternatif yöntem dene
    if (!contracts || contracts.length === 0) {
      try {
        // Tüm kullanıcıları çek ve kiracıyı bul
        const allUsers = await API.get("/Kullanici");
        const tenant = await API.get("/Kiraci");
        const foundTenant = Array.isArray(tenant) ? tenant.find(t => (t.kiraciID || t.KiraciID) == kiraciID) : null;
        
        if (foundTenant) {
          const tenantEmail = foundTenant.email || foundTenant.Email;
          if (tenantEmail && Array.isArray(allUsers)) {
            const tenantUser = allUsers.find(u => {
              const userEmail = (u.email || u.Email || "").toLowerCase();
              return userEmail === tenantEmail.toLowerCase();
            });
            
            if (tenantUser) {
              const tenantUserId = tenantUser.kullaniciID || tenantUser.KullaniciID;
              if (tenantUserId) {
                contracts = await API.get(`/KiraSozlesme?userId=${tenantUserId}&role=Tenant`);
              }
            }
          }
        }
      } catch (altError) {
        // Alternatif yöntem başarısız
      }
    }
    
    if (!Array.isArray(contracts) || contracts.length === 0) {
      container.innerHTML = "<p style='color: #8d97ad; text-align: center; padding: 1rem;'>Sözleşme bulunamadı.</p>";
      return;
    }

    // Kiracı ID'si ile eşleştir (hem aktif hem pasif)
    const tenantContracts = contracts.filter(c => {
      const cKiraciID = c.kiraciID || c.KiraciID;
      return cKiraciID == kiraciID;
    });

    if (tenantContracts.length === 0) {
      container.innerHTML = "<p style='color: #8d97ad; text-align: center; padding: 1rem;'>Bu kiracıya ait sözleşme bulunmuyor.</p>";
      return;
    }

    // Aktif sözleşmeleri önce göster
    tenantContracts.sort((a, b) => {
      const aAktif = a.aktifMi !== undefined ? a.aktifMi : a.AktifMi;
      const bAktif = b.aktifMi !== undefined ? b.aktifMi : b.AktifMi;
      return bAktif ? 1 : -1; // Aktifler önce
    });

    container.innerHTML = "";
    tenantContracts.forEach(contract => {
      const mulkBaslik = contract.mulkBaslik || contract.MulkBaslik || "Mülk";
      const mulkAdres = contract.mulkAdres || contract.MulkAdres || "-";
      const aylikKira = contract.aylikKiraTutar || contract.AylikKiraTutar || 0;
      const paraBirimi = contract.paraBirimiKod || contract.ParaBirimiKod || "TRY";
      const baslangic = contract.baslangicTarihi || contract.BaslangicTarihi;
      const bitis = contract.bitisTarihi || contract.BitisTarihi;
      const sozlesmeNo = contract.sozlesmeNo || contract.SozlesmeNo || "-";
      const aktifMi = contract.aktifMi !== undefined ? contract.aktifMi : contract.AktifMi;

      const baslangicStr = baslangic ? new Date(baslangic).toLocaleDateString("tr-TR") : "-";
      const bitisStr = bitis ? new Date(bitis).toLocaleDateString("tr-TR") : "Belirsiz";

      const currencySymbol = paraBirimi === "TRY" ? "₺" : paraBirimi === "USD" ? "$" : paraBirimi === "EUR" ? "€" : paraBirimi;
      const formattedAmount = aylikKira.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      
      const durumBadge = aktifMi 
        ? '<span class="status-badge status-active">Aktif</span>'
        : '<span class="status-badge status-late">Pasif</span>';

      const html = `
        <div class="contract-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <h4 style="margin: 0;">${mulkBaslik}</h4>
            ${durumBadge}
          </div>
          <p><strong>Adres:</strong> ${mulkAdres}</p>
          <p><strong>Aylık Kira:</strong> ${formattedAmount} ${currencySymbol}</p>
          <p><strong>Sözleşme No:</strong> ${sozlesmeNo}</p>
          <p><strong>Başlangıç:</strong> ${baslangicStr}</p>
          <p><strong>Bitiş:</strong> ${bitisStr}</p>
        </div>
      `;
      container.innerHTML += html;
    });
  } catch (error) {
    container.innerHTML = "<p style='color: #ff4b5c; text-align: center; padding: 1rem;'>Sözleşmeler yüklenirken hata oluştu.</p>";
  }
}

// Kiracının Ödemelerini Yükle
async function loadTenantPayments(kiraciID, tenantKullaniciID) {
  const container = document.getElementById("detailPayments");
  container.innerHTML = "<p style='color: #8d97ad; text-align: center; padding: 1rem;'>Yükleniyor...</p>";

  try {
    let payments = [];
    
    // Önce sözleşmeleri bul
    let contracts = await API.get("/KiraSozlesme");
    
    // Eğer boşsa, alternatif yöntem dene
    if (!contracts || contracts.length === 0) {
      if (tenantKullaniciID) {
        try {
          contracts = await API.get(`/KiraSozlesme?userId=${tenantKullaniciID}&role=Tenant`);
        } catch (altError) {
          // Alternatif yöntem başarısız
        }
      }
    }
    
    if (Array.isArray(contracts) && contracts.length > 0) {
      const tenantContracts = contracts.filter(c => {
        const cKiraciID = c.kiraciID || c.KiraciID;
        return cKiraciID == kiraciID;
      });

      // Her sözleşme için ödemeleri çek
      for (const contract of tenantContracts) {
        const sozlesmeID = contract.kiraSozlesmeID || contract.KiraSozlesmeID;
        if (sozlesmeID) {
          try {
            const contractPayments = await API.get(`/KiraOdeme/sozlesme/${sozlesmeID}`);
            if (Array.isArray(contractPayments)) {
              payments = payments.concat(contractPayments);
            }
          } catch (err) {
            // Ödemeler çekilemedi
          }
        }
      }
    }
    
    // Eğer hala ödeme yoksa, tüm ödemeleri çek ve filtrele
    if (payments.length === 0) {
      try {
        const allPayments = await API.get("/KiraOdeme");
        if (Array.isArray(allPayments)) {
          // Sözleşme ID'leri ile eşleştir
          const tenantContractIds = [];
          if (Array.isArray(contracts)) {
            contracts.filter(c => {
              const cKiraciID = c.kiraciID || c.KiraciID;
              return cKiraciID == kiraciID;
            }).forEach(c => {
              const sozlesmeID = c.kiraSozlesmeID || c.KiraSozlesmeID;
              if (sozlesmeID) tenantContractIds.push(sozlesmeID);
            });
          }
          
          payments = allPayments.filter(p => {
            const pSozlesmeID = p.kiraSozlesmeID || p.KiraSozlesmeID;
            return tenantContractIds.includes(pSozlesmeID);
          });
        }
      } catch (allPaymentsError) {
        // Tüm ödemeler çekilemedi
      }
    }

    if (payments.length === 0) {
      container.innerHTML = "<p style='color: #8d97ad; text-align: center; padding: 1rem;'>Ödeme geçmişi bulunmuyor.</p>";
      return;
    }

    // Tarihe göre sırala (en yeni önce)
    payments.sort((a, b) => {
      const dateA = new Date(a.olusturmaTarihi || a.OlusturmaTarihi || 0);
      const dateB = new Date(b.olusturmaTarihi || b.OlusturmaTarihi || 0);
      return dateB - dateA;
    });

    container.innerHTML = "";
    payments.slice(0, 10).forEach(payment => {
      const tutar = payment.tutar || payment.Tutar || 0;
      const paraBirimiID = payment.paraBirimiID || payment.ParaBirimiID;
      const paraBirimiKod = payment.paraBirimiKod || payment.ParaBirimiKod;
      const odemeTarihi = payment.odemeTarihi || payment.OdemeTarihi;
      const vadeTarihi = payment.vadeTarihi || payment.VadeTarihi;
      const odemeDurumID = payment.odemeDurumID || payment.OdemeDurumID;
      const durum = payment.durum || payment.Durum || "";

      // Para birimi sembolü
      let currencySymbol = "";
      if (paraBirimiKod) {
        currencySymbol = paraBirimiKod === "TRY" ? "₺" : paraBirimiKod === "USD" ? "$" : paraBirimiKod === "EUR" ? "€" : paraBirimiKod;
      } else {
        // ID'ye göre (fallback)
        currencySymbol = paraBirimiID === 1 ? "₺" : paraBirimiID === 2 ? "$" : paraBirimiID === 3 ? "€" : "₺";
      }
      
      const formattedAmount = tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const odemeTarihiStr = odemeTarihi ? new Date(odemeTarihi).toLocaleDateString("tr-TR") : "-";
      const vadeTarihiStr = vadeTarihi ? new Date(vadeTarihi).toLocaleDateString("tr-TR") : "-";

      // Ödeme durumu - önce durum string'ini kontrol et, sonra tarihe göre belirle
      let statusBadge = "";
      if (durum === "Paid" || durum === "paid" || odemeTarihi) {
        statusBadge = '<span class="status-badge status-paid">Ödendi</span>';
      } else if (durum === "Late" || durum === "late" || (vadeTarihi && new Date(vadeTarihi) < new Date())) {
        statusBadge = '<span class="status-badge status-late">Gecikmiş</span>';
      } else {
        statusBadge = '<span class="status-badge status-pending">Beklemede</span>';
      }

      const html = `
        <div class="payment-card">
          <h4>${formattedAmount} ${currencySymbol}</h4>
          <p><strong>Vade Tarihi:</strong> ${vadeTarihiStr}</p>
          <p><strong>Ödeme Tarihi:</strong> ${odemeTarihiStr}</p>
          <p><strong>Durum:</strong> ${statusBadge}</p>
        </div>
      `;
      container.innerHTML += html;
    });

    if (payments.length > 10) {
      container.innerHTML += `<p style='color: #8d97ad; text-align: center; padding: 1rem; font-size: 0.85rem;'>Toplam ${payments.length} ödeme kaydı bulundu. Son 10 kayıt gösteriliyor.</p>`;
    }
  } catch (error) {
    container.innerHTML = "<p style='color: #ff4b5c; text-align: center; padding: 1rem;'>Ödemeler yüklenirken hata oluştu.</p>";
  }
}

// Kiracının Bakım Taleplerini Yükle
async function loadTenantMaintenance(kiraciID) {
  const container = document.getElementById("detailMaintenance");
  container.innerHTML = "<p style='color: #8d97ad; text-align: center; padding: 1rem;'>Yükleniyor...</p>";

  try {
    // Önce sözleşmeleri bul
    let contracts = await API.get("/KiraSozlesme");
    
    // Eğer boşsa, alternatif yöntem dene
    if (!contracts || contracts.length === 0) {
      try {
        const tenant = await API.get("/Kiraci");
        const foundTenant = Array.isArray(tenant) ? tenant.find(t => (t.kiraciID || t.KiraciID) == kiraciID) : null;
        
        if (foundTenant) {
          const tenantEmail = foundTenant.email || foundTenant.Email;
          if (tenantEmail) {
            const allUsers = await API.get("/Kullanici");
            if (Array.isArray(allUsers)) {
              const tenantUser = allUsers.find(u => {
                const userEmail = (u.email || u.Email || "").toLowerCase();
                return userEmail === tenantEmail.toLowerCase();
              });
              
              if (tenantUser) {
                const tenantUserId = tenantUser.kullaniciID || tenantUser.KullaniciID;
                if (tenantUserId) {
                  contracts = await API.get(`/KiraSozlesme?userId=${tenantUserId}&role=Tenant`);
                }
              }
            }
          }
        }
      } catch (altError) {
        // Alternatif yöntem başarısız
      }
    }
    
    if (!Array.isArray(contracts) || contracts.length === 0) {
      container.innerHTML = "<p style='color: #8d97ad; text-align: center; padding: 1rem;'>Bakım talebi bulunamadı.</p>";
      return;
    }

    const tenantContracts = contracts.filter(c => {
      const cKiraciID = c.kiraciID || c.KiraciID;
      return cKiraciID == kiraciID;
    });

    if (tenantContracts.length === 0) {
      container.innerHTML = "<p style='color: #8d97ad; text-align: center; padding: 1rem;'>Bu kiracıya ait sözleşme bulunamadı.</p>";
      return;
    }

    // Her sözleşme için mülk ID'lerini topla
    const mulkIDs = tenantContracts.map(c => c.mulkID || c.MulkID).filter(id => id);

    if (mulkIDs.length === 0) {
      container.innerHTML = "<p style='color: #8d97ad; text-align: center; padding: 1rem;'>Mülk bilgisi bulunamadı.</p>";
      return;
    }

    // Her mülk için bakım taleplerini çek
    let allRequests = [];
    for (const mulkID of mulkIDs) {
      try {
        const requests = await API.get(`/BakimTalep/mulk/${mulkID}`);
        if (Array.isArray(requests)) {
          allRequests = allRequests.concat(requests);
        }
      } catch (err) {
        // Bakım talepleri çekilemedi
      }
    }

    if (allRequests.length === 0) {
      container.innerHTML = "<p style='color: #8d97ad; text-align: center; padding: 1rem;'>Bakım talebi bulunmuyor.</p>";
      return;
    }

    // Tarihe göre sırala (en yeni önce)
    allRequests.sort((a, b) => {
      const dateA = new Date(a.talepTarihi || a.TalepTarihi || 0);
      const dateB = new Date(b.talepTarihi || b.TalepTarihi || 0);
      return dateB - dateA;
    });

    container.innerHTML = "";
    allRequests.slice(0, 10).forEach(request => {
      const aciklama = request.aciklama || request.Aciklama || "-";
      const durum = request.durum || request.Durum || "Acik";
      const talepTarihi = request.talepTarihi || request.TalepTarihi;
      const gerceklesmeTarihi = request.gerceklesmeTarihi || request.GerceklesmeTarihi;
      const tahminiTutar = request.tahminiTutar || request.TahminiTutar;
      const gercekTutar = request.gercekTutar || request.GercekTutar;

      const talepTarihiStr = talepTarihi ? new Date(talepTarihi).toLocaleDateString("tr-TR") : "-";
      const gerceklesmeTarihiStr = gerceklesmeTarihi ? new Date(gerceklesmeTarihi).toLocaleDateString("tr-TR") : "-";

      // Durum rozeti
      let statusBadge = "";
      if (durum === "Tamamlandi" || durum === "Tamamlandı") {
        statusBadge = '<span class="status-badge status-completed">Tamamlandı</span>';
      } else if (durum === "Devam Ediyor") {
        statusBadge = '<span class="status-badge status-pending">Devam Ediyor</span>';
      } else {
        statusBadge = '<span class="status-badge status-open">Açık</span>';
      }

      const html = `
        <div class="maintenance-card">
          <h4>${aciklama.substring(0, 50)}${aciklama.length > 50 ? '...' : ''}</h4>
          <p><strong>Durum:</strong> ${statusBadge}</p>
          <p><strong>Talep Tarihi:</strong> ${talepTarihiStr}</p>
          ${gerceklesmeTarihiStr !== "-" ? `<p><strong>Gerçekleşme Tarihi:</strong> ${gerceklesmeTarihiStr}</p>` : ""}
          ${tahminiTutar ? `<p><strong>Tahmini Tutar:</strong> ${tahminiTutar.toLocaleString("tr-TR")} ₺</p>` : ""}
          ${gercekTutar ? `<p><strong>Gerçek Tutar:</strong> ${gercekTutar.toLocaleString("tr-TR")} ₺</p>` : ""}
        </div>
      `;
      container.innerHTML += html;
    });

    if (allRequests.length > 10) {
      container.innerHTML += `<p style='color: #8d97ad; text-align: center; padding: 1rem; font-size: 0.85rem;'>Toplam ${allRequests.length} bakım talebi bulundu. Son 10 kayıt gösteriliyor.</p>`;
    }
  } catch (error) {
    container.innerHTML = "<p style='color: #ff4b5c; text-align: center; padding: 1rem;'>Bakım talepleri yüklenirken hata oluştu.</p>";
  }
}

// Çıkış
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});


