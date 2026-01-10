// Türkçe tarih formatını parse et (dd.MM.yyyy -> Date)
function parseTurkishDate(dateStr) {
  if (!dateStr) return null;
  
  // Eğer zaten Date objesiyse direkt döndür
  if (dateStr instanceof Date) {
    return isNaN(dateStr.getTime()) ? null : dateStr;
  }
  
  // String formatındaysa parse et
  if (typeof dateStr === 'string') {
    // "dd.MM.yyyy" formatını kontrol et
    const match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // JavaScript'te ay 0-11 arası
      const year = parseInt(match[3], 10);
      const date = new Date(year, month, day);
      return isNaN(date.getTime()) ? null : date;
    }
    
    // Standart Date parse dene
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }
  
  return null;
}

// Ödeme durumunu hesapla (finans.js'deki ile aynı mantık)
function calculatePaymentStatus(vadeTarihi, odemeTarihi) {
  // Null/undefined kontrolü
  if (!vadeTarihi || vadeTarihi === "null" || vadeTarihi === "undefined" || vadeTarihi === "") {
    return { status: "Pending", color: "#ffb300" };
  }
  
  // Ödeme tarihi varsa ve geçerliyse -> Paid
  if (odemeTarihi && odemeTarihi !== "null" && odemeTarihi !== "undefined" && odemeTarihi.trim() !== "") {
    try {
      const odemeDate = new Date(odemeTarihi);
      if (!isNaN(odemeDate.getTime())) {
        return { status: "Paid", color: "#00c853" };
      }
    } catch (e) {
      // Tarih parse edilemezse devam et
    }
  }
  
  // Vade tarihini kontrol et
  try {
    const vadeDate = new Date(vadeTarihi);
    if (isNaN(vadeDate.getTime())) {
      return { status: "Pending", color: "#ffb300" };
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    vadeDate.setHours(0, 0, 0, 0);
    
    // Vade geçmişse -> Late
    if (vadeDate < today) {
      return { status: "Late", color: "#ff4b5c" };
    }
    
    // Vade henüz gelmemişse -> Pending
    return { status: "Pending", color: "#ffb300" };
  } catch (e) {
    return { status: "Pending", color: "#ffb300" };
  }
}

// Geciken Ödemeleri Yükle (Dashboard Widget - Sadece Sayı)
async function loadLatePayments(ownerId) {
  try {
    // Önce owner'ın tüm ödemelerini çek
    const payments = await API.get(`/KiraOdeme/owner/${ownerId}`);
    
    // Frontend'de geciken ödemeleri filtrele
    let ownerLatePayments = [];
    if (payments && Array.isArray(payments)) {
      ownerLatePayments = payments.filter(p => {
        // Aktif olmayan ödemeleri atla
        const aktifMi = p.aktifMi !== undefined ? p.aktifMi : p.AktifMi;
        if (aktifMi === false || aktifMi === 0) {
          return false;
        }
        
        const vadeTarihi = p.vadeTarihi || p.VadeTarihi;
        const odemeTarihi = p.odemeTarihi || p.OdemeTarihi;
        
        // Durumu hesapla
        const status = calculatePaymentStatus(vadeTarihi, odemeTarihi);
        
        // Sadece Late durumundaki ödemeleri al
        return status.status === "Late";
      });
    }
    
    const latePaymentsEl = document.getElementById("latePayments");
    if (latePaymentsEl) {
      if (ownerLatePayments.length > 0) {
        latePaymentsEl.innerText = ownerLatePayments.length;
        latePaymentsEl.style.color = "#ff4b5c";
      } else {
        latePaymentsEl.innerText = "0";
        latePaymentsEl.style.color = "#00c853";
      }
    }
  } catch (e) {
    console.error("Geciken ödemeler yüklenirken hata:", e);
    const latePaymentsEl = document.getElementById("latePayments");
    if (latePaymentsEl) {
      latePaymentsEl.innerText = "-";
    }
  }
}

// Geciken Ödemeleri Liste Olarak Yükle (Dashboard List)
async function loadLatePaymentsList() {
  const container = document.getElementById("latePaymentsList");
  if (!container) return;
  
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    container.innerHTML = '<p style="text-align:center; color:#888; padding:1rem;">Kullanıcı bilgisi bulunamadı.</p>';
    return;
  }
  
  const user = JSON.parse(userStr);
  
  // Yükleniyor mesajı
  container.innerHTML = '<p style="text-align:center; color:#888; padding:1rem;"><i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...</p>';
  
  try {
    // Owner'ın tüm ödemelerini çek
    const payments = await API.get(`/KiraOdeme/owner/${user.kullaniciID}`);
    
    // Frontend'de geciken ödemeleri filtrele
    let latePayments = [];
    if (payments && Array.isArray(payments)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      latePayments = payments.filter(p => {
        // Aktif olmayan ödemeleri atla
        const aktifMi = p.aktifMi !== undefined ? p.aktifMi : p.AktifMi;
        if (aktifMi === false || aktifMi === 0) {
          return false;
        }
        
        const vadeTarihi = p.vadeTarihi || p.VadeTarihi;
        const odemeTarihi = p.odemeTarihi || p.OdemeTarihi;
        
        // Durumu hesapla
        const status = calculatePaymentStatus(vadeTarihi, odemeTarihi);
        
        // Sadece Late durumundaki ödemeleri al
        return status.status === "Late";
      });
      
      // Vade tarihine göre sırala (en eski önce)
      latePayments.sort((a, b) => {
        const vadeA = a.vadeTarihi || a.VadeTarihi;
        const vadeB = b.vadeTarihi || b.VadeTarihi;
        if (!vadeA) return 1;
        if (!vadeB) return -1;
        return new Date(vadeA) - new Date(vadeB);
      });
    }
    
    container.innerHTML = "";
    
    if (latePayments && latePayments.length > 0) {
      latePayments.forEach(p => {
        const id = p.kiraOdemeID || p.KiraOdemeID;
        const vade = p.vadeTarihi || p.VadeTarihi;
        const tutar = p.tutar || p.Tutar || 0;
        const paraBirimi = p.paraBirimi || p.ParaBirimi || "TRY";
        const mulk = p.mulk || p.MulkBaslik || p.Mulk || "Mülk";
        const kiraci = p.kiraci || p.KiraciAd || p.Kiraci || "Kiracı";
        
        // Vade tarihini formatla
        let vadeStr = "-";
        if (vade) {
          try {
            vadeStr = new Date(vade).toLocaleDateString("tr-TR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric"
            });
          } catch (dateError) {
            vadeStr = vade;
          }
        }
        
        // Gecikme günü hesapla
        let gecikmeGunu = 0;
        if (vade) {
          try {
            const vadeDate = new Date(vade);
            vadeDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const diffTime = today - vadeDate;
            gecikmeGunu = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          } catch (dateError) {
            // Sessiz hata yönetimi
          }
        }
        
        // Para birimi sembolü
        const currencySymbol = paraBirimi === "TRY" ? "₺" : paraBirimi === "USD" ? "$" : paraBirimi === "EUR" ? "€" : paraBirimi;
        
        const html = `
          <div onclick="window.location.href='finans.html?tab=late'" style="padding:12px; background:rgba(255,75,92,0.1); border-radius:8px; margin-bottom:8px; border-left:3px solid #ff4b5c; cursor:pointer; transition:0.3s;" onmouseover="this.style.background='rgba(255,75,92,0.2)'" onmouseout="this.style.background='rgba(255,75,92,0.1)'">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
              <div style="font-weight:600; color:#fff; flex:1;">${mulk}</div>
              <span style="background:rgba(255,75,92,0.3); color:#ff4b5c; padding:4px 8px; border-radius:12px; font-size:0.75rem; font-weight:600;">${gecikmeGunu} gün</span>
            </div>
            <div style="font-size:0.85rem; color:#8d97ad; margin-bottom:6px;">${kiraci}</div>
            <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.75rem;">
              <div style="color:#666;"><i class="fa-regular fa-calendar"></i> Vade: ${vadeStr}</div>
              <div style="color:#ff4b5c; font-weight:600; font-size:0.9rem;"><i class="fa-solid fa-money-bill-wave"></i> ${parseFloat(tutar).toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${currencySymbol}</div>
            </div>
          </div>
        `;
        container.innerHTML += html;
      });
    } else {
      container.innerHTML = '<p style="text-align:center; color:#888; padding:1rem;"><i class="fa-solid fa-check-circle"></i><br>Geciken ödeme bulunmuyor.</p>';
    }
  } catch (e) {
    container.innerHTML = '<p style="text-align:center; color:#ff4b5c; padding:1rem;"><i class="fa-solid fa-exclamation-triangle"></i><br>Yüklenemedi. Lütfen sayfayı yenileyin.</p>';
  }
}

// Hatırlatıcıları Yükle
async function loadReminders() {
  const container = document.getElementById("remindersList");
  if (!container) return;
  
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    container.innerHTML = '<p style="text-align:center; color:#888; padding:1rem;">Kullanıcı bilgisi bulunamadı.</p>';
    return;
  }
  
  const user = JSON.parse(userStr);
  
  // Yükleniyor mesajı
  container.innerHTML = '<p style="text-align:center; color:#888; padding:1rem;"><i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...</p>';
  
  try {
    // Önce yaklaşan hatırlatıcıları çek
    let reminders = await API.get(`/Hatirlatici/yaklasan/${user.kullaniciID}?gunSayisi=15`);
    
    // Eğer yaklaşan endpoint çalışmıyorsa, tüm hatırlatıcıları çek ve frontend'de filtrele
    if (!reminders || !Array.isArray(reminders)) {
      try {
        const allReminders = await API.get(`/Hatirlatici/kullanici/${user.kullaniciID}`);
        if (allReminders && Array.isArray(allReminders)) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // Aktif hatırlatıcıları filtrele ve yaklaşanları bul
          reminders = allReminders.filter(r => {
            const aktifMi = r.aktifMi !== undefined ? r.aktifMi : r.AktifMi;
            if (!aktifMi) return false;
            
            const tarih = r.hatirlaticiTarihi || r.HatirlaticiTarihi;
            if (!tarih) return false;
            
            try {
              const reminderDate = new Date(tarih);
              
              // Tarih geçerliliğini kontrol et
              if (isNaN(reminderDate.getTime())) {
                return false; // Geçersiz tarihleri filtrele
              }
              
              reminderDate.setHours(0, 0, 0, 0);
              
              // 15 gün içindeki hatırlatıcıları al
              const diffTime = reminderDate - today;
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              // NaN kontrolü
              if (isNaN(diffDays)) {
                return false; // Hesaplanamayan tarihleri filtrele
              }
              
              return diffDays >= -2 && diffDays <= 15; // 2 gün geçmiş + 15 gün ileri
            } catch (error) {
              return false; // Hata durumunda filtrele
            }
          });
        }
      } catch (fallbackError) {
        // Sessiz hata yönetimi
      }
    }
    
    container.innerHTML = "";
    
    if (reminders && Array.isArray(reminders) && reminders.length > 0) {
      // Tarihe göre sırala (yaklaşanlar önce)
      reminders.sort((a, b) => {
        // Eğer KalanGun varsa (yaklasan endpoint'inden geliyorsa), ona göre sırala
        if (a.kalanGun !== undefined || a.KalanGun !== undefined) {
          const gunA = a.kalanGun !== undefined ? a.kalanGun : a.KalanGun;
          const gunB = b.kalanGun !== undefined ? b.kalanGun : b.KalanGun;
          return (gunA || 0) - (gunB || 0);
        }
        // Yoksa tarihe göre sırala
        const tarihA = a.hatirlaticiTarihi || a.HatirlaticiTarihi;
        const tarihB = b.hatirlaticiTarihi || b.HatirlaticiTarihi;
        if (!tarihA) return 1;
        if (!tarihB) return -1;
        // String formatındaki tarihi parse et (dd.MM.yyyy)
        const dateA = parseTurkishDate(tarihA);
        const dateB = parseTurkishDate(tarihB);
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA - dateB;
      });
      
      reminders.forEach(r => {
        const id = r.hatirlaticiID || r.HatirlaticiID;
        const baslik = r.baslik || r.Baslik || "Hatırlatıcı";
        const aciklama = r.aciklama || r.Aciklama || "";
        const tarih = r.hatirlaticiTarihi || r.HatirlaticiTarihi;
        const kalanGun = r.kalanGun !== undefined ? r.kalanGun : r.KalanGun;
        
        // Tarih formatla - eğer string formatında geliyorsa direkt kullan
        let tarihStr = "-";
        if (tarih) {
          // Eğer zaten "dd.MM.yyyy" formatındaysa direkt kullan
          if (typeof tarih === 'string' && tarih.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
            tarihStr = tarih;
          } else {
            try {
              const tarihObj = parseTurkishDate(tarih) || new Date(tarih);
              if (!isNaN(tarihObj.getTime())) {
                tarihStr = tarihObj.toLocaleDateString("tr-TR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric"
                });
              } else {
                tarihStr = tarih;
              }
            } catch (dateError) {
              tarihStr = tarih;
            }
          }
        }
        
        // Kalan gün hesapla - eğer backend'den geliyorsa onu kullan
        let daysText = "";
        let borderColor = "#00d4ff";
        let iconClass = "fa-regular fa-bell";
        
        if (kalanGun !== undefined && kalanGun !== null && !isNaN(kalanGun)) {
          // Backend'den gelen KalanGun değerini kullan
          const diffDays = parseInt(kalanGun);
          
          if (diffDays < 0) {
            daysText = `Süresi geçti (${Math.abs(diffDays)} gün)`;
            borderColor = "#888";
            iconClass = "fa-solid fa-exclamation-triangle";
          } else if (diffDays === 0) {
            daysText = "Bugün";
            borderColor = "#ff4b5c";
            iconClass = "fa-solid fa-bell";
          } else if (diffDays <= 3) {
            daysText = `${diffDays} gün kaldı`;
            borderColor = "#ff4b5c";
            iconClass = "fa-solid fa-bell";
          } else if (diffDays <= 7) {
            daysText = `${diffDays} gün kaldı`;
            borderColor = "#ffb300";
            iconClass = "fa-regular fa-bell";
          } else {
            daysText = `${diffDays} gün kaldı`;
            borderColor = "#00d4ff";
            iconClass = "fa-regular fa-bell";
          }
        } else if (tarih) {
          // Backend'den KalanGun gelmediyse, tarihten hesapla
          try {
            const reminderDate = parseTurkishDate(tarih) || new Date(tarih);
            
            // Tarih geçerliliğini kontrol et
            if (!reminderDate || isNaN(reminderDate.getTime())) {
              daysText = "Geçersiz tarih";
              borderColor = "#888";
              iconClass = "fa-solid fa-exclamation-triangle";
            } else {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              reminderDate.setHours(0, 0, 0, 0);
              
              const diffTime = reminderDate - today;
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              // NaN kontrolü
              if (isNaN(diffDays)) {
                daysText = "Tarih hesaplanamadı";
                borderColor = "#888";
                iconClass = "fa-solid fa-exclamation-triangle";
              } else if (diffDays < 0) {
                daysText = `Süresi geçti (${Math.abs(diffDays)} gün)`;
                borderColor = "#888";
                iconClass = "fa-solid fa-exclamation-triangle";
              } else if (diffDays === 0) {
                daysText = "Bugün";
                borderColor = "#ff4b5c";
                iconClass = "fa-solid fa-bell";
              } else if (diffDays <= 3) {
                daysText = `${diffDays} gün kaldı`;
                borderColor = "#ff4b5c";
                iconClass = "fa-solid fa-bell";
              } else if (diffDays <= 7) {
                daysText = `${diffDays} gün kaldı`;
                borderColor = "#ffb300";
                iconClass = "fa-regular fa-bell";
              } else {
                daysText = `${diffDays} gün kaldı`;
                borderColor = "#00d4ff";
                iconClass = "fa-regular fa-bell";
              }
            }
          } catch (dateError) {
            daysText = "Tarih hatası";
            borderColor = "#888";
            iconClass = "fa-solid fa-exclamation-triangle";
          }
        }
        
        const html = `
          <div onclick="window.location.href='hatirlaticilar.html'" style="padding:12px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:8px; border-left:3px solid ${borderColor}; cursor:pointer; transition:0.3s;" onmouseover="this.style.background='rgba(0,0,0,0.3)'" onmouseout="this.style.background='rgba(0,0,0,0.2)'">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
              <div style="font-weight:600; color:#fff; flex:1;">${baslik}</div>
              <i class="${iconClass}" style="color:${borderColor}; margin-left:8px;"></i>
            </div>
            ${aciklama ? `<div style="font-size:0.85rem; color:#8d97ad; margin-bottom:6px; line-height:1.4;">${aciklama}</div>` : ""}
            <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.75rem;">
              <div style="color:#666;"><i class="fa-regular fa-calendar"></i> ${tarihStr}</div>
              ${daysText ? `<div style="color:${borderColor}; font-weight:600;"><i class="fa-solid fa-clock"></i> ${daysText}</div>` : ""}
            </div>
          </div>
        `;
        container.innerHTML += html;
      });
    } else {
      container.innerHTML = '<p style="text-align:center; color:#888; padding:1rem;"><i class="fa-regular fa-bell"></i><br>Yaklaşan hatırlatıcı bulunmuyor.</p>';
    }
  } catch (e) {
    container.innerHTML = '<p style="text-align:center; color:#ff4b5c; padding:1rem;"><i class="fa-solid fa-exclamation-triangle"></i><br>Yüklenemedi. Lütfen sayfayı yenileyin.</p>';
  }
}

// Dashboard verilerini yükle
async function loadDashboardData() {
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }

  const user = JSON.parse(userStr);
  
  if (user.rol !== "Owner") {
    window.location.href = "../index.html";
    return;
  }

  // Kullanıcı bilgilerini güncelle
  const userNameEl = document.getElementById("userName");
  if (userNameEl) userNameEl.innerText = user.adSoyad;
  
  const headerUserNameEl = document.getElementById("headerUserName");
  if (headerUserNameEl) headerUserNameEl.innerText = user.adSoyad;
  
  const userImgEl = document.getElementById("userImg");
  if (userImgEl) {
    userImgEl.src = `https://ui-avatars.com/api/?name=${user.adSoyad}&background=00d4ff&color=fff`;
  }

  // Hatırlatıcıları yükle
  loadReminders();
  
  // Geciken ödemeleri yükle (sayı için)
  loadLatePayments(user.kullaniciID);
  
  // Geciken ödemeleri liste olarak yükle
  loadLatePaymentsList();
  
  try {
    // Backend'den Dashboard Verilerini Çek
    const dashboardData = await API.get(`/Dashboard/owner/${user.kullaniciID}`);
    // Fallback: küçük harf ile dene
    if (!dashboardData) {
      const dashboardDataAlt = await API.get(`/dashboard/owner/${user.kullaniciID}`);
      if (dashboardDataAlt) {
        Object.assign(dashboardData || {}, dashboardDataAlt);
      }
    }

    if (dashboardData) {
      // --- Kartları Doldur ---
      const totalPropertiesEl = document.getElementById("totalProperties");
      if (totalPropertiesEl) {
        totalPropertiesEl.innerText = dashboardData.mulkSayisi || dashboardData.MulkSayisi || 0;
      }
      
      const activeContractsEl = document.getElementById("activeContracts");
      if (activeContractsEl) {
        activeContractsEl.innerText = dashboardData.aktifSozlesme || dashboardData.AktifSozlesme || 0;
      }
      
      // Geciken ödeme sayısı loadLatePayments() fonksiyonu tarafından hesaplanacak
      // Burada set etmiyoruz çünkü frontend'de daha doğru hesaplama yapılıyor

      // Gelir - Tüm para birimlerini topla veya sadece TRY göster
      const monthIncomeEl = document.getElementById("monthIncome");
      if (monthIncomeEl) {
        let monthIncome = 0;
        let currency = "TRY";
        
        // Backend'den gelen veriyi kontrol et
        const buAyGelir = dashboardData.buAyGelir || dashboardData.BuAyGelir;
        if (buAyGelir && Array.isArray(buAyGelir) && buAyGelir.length > 0) {
          const tryGelir = buAyGelir.find(
            (x) => (x.paraBirimi || x.ParaBirimi) === "TRY"
          );
          if (tryGelir) {
            monthIncome = tryGelir.toplam || tryGelir.Toplam || 0;
          }
        }
        
        // Eğer backend'den gelmediyse, ödemeleri çekip manuel hesapla
        if (monthIncome === 0) {
          try {
            const payments = await API.get(`/KiraOdeme/owner/${user.kullaniciID}`);
            if (payments && Array.isArray(payments)) {
              const now = new Date();
              const currentMonth = now.getMonth();
              const currentYear = now.getFullYear();
              
              // Bu ay ödenen ödemeleri filtrele ve topla
              const thisMonthPayments = payments.filter(p => {
                const odemeTarihi = p.odemeTarihi || p.OdemeTarihi;
                if (!odemeTarihi) return false;
                
                // Ödeme tarihi null, boş string veya "null" string değilse ödenmiş demektir
                if (odemeTarihi === null || odemeTarihi === "" || odemeTarihi === "null" || odemeTarihi === "undefined") {
                  return false;
                }
                
                const odemeDate = new Date(odemeTarihi);
                
                // Bu ay yapılan ödemeleri say
                return odemeDate.getMonth() === currentMonth && 
                       odemeDate.getFullYear() === currentYear;
              });
              
              // Tüm para birimlerini grupla ve topla
              const incomeByCurrency = {};
              thisMonthPayments.forEach(p => {
                const paraBirimi = p.paraBirimi || p.ParaBirimi || "TRY";
                const tutar = parseFloat(p.tutar || p.Tutar || 0);
                
                if (!incomeByCurrency[paraBirimi]) {
                  incomeByCurrency[paraBirimi] = 0;
                }
                incomeByCurrency[paraBirimi] += tutar;
              });
              
              // TRY varsa onu göster, yoksa ilk para birimini göster
              if (incomeByCurrency["TRY"]) {
                monthIncome = incomeByCurrency["TRY"];
                currency = "TRY";
              } else if (Object.keys(incomeByCurrency).length > 0) {
                const firstCurrency = Object.keys(incomeByCurrency)[0];
                monthIncome = incomeByCurrency[firstCurrency];
                currency = firstCurrency;
              }
              
              // Eğer birden fazla para birimi varsa, hepsini göster
              const currencyKeys = Object.keys(incomeByCurrency);
              if (currencyKeys.length > 1) {
                // Tüm para birimlerini formatla
                const allCurrencies = currencyKeys.map(curr => {
                  const symbol = curr === "TRY" ? "₺" : curr === "USD" ? "$" : curr === "EUR" ? "€" : curr;
                  return incomeByCurrency[curr].toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + " " + symbol;
                }).join(" / ");
                monthIncomeEl.innerText = allCurrencies;
                return; // Early return, çünkü zaten gösterdik
              }
            }
          } catch (paymentError) {
            // Sessiz hata yönetimi
          }
        }
        
        // Para birimi sembolünü belirle
        const currencySymbol = currency === "TRY" ? "₺" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;
        monthIncomeEl.innerText = monthIncome.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + " " + currencySymbol;
      }

    } else {
      // Veri gelmediyse varsayılan değerler
      const totalPropertiesEl = document.getElementById("totalProperties");
      if (totalPropertiesEl) totalPropertiesEl.innerText = "0";
      
      const activeContractsEl = document.getElementById("activeContracts");
      if (activeContractsEl) activeContractsEl.innerText = "0";
      
      const latePaymentsEl = document.getElementById("latePayments");
      if (latePaymentsEl) latePaymentsEl.innerText = "0";
      
      const monthIncomeEl = document.getElementById("monthIncome");
      if (monthIncomeEl) {
        // Backend'den veri gelmediyse, ödemeleri çekip manuel hesapla
        try {
          const payments = await API.get(`/KiraOdeme/owner/${user.kullaniciID}`);
          let monthIncome = 0;
          let currency = "TRY";
          
          if (payments && Array.isArray(payments)) {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            
            // Bu ay ödenen ödemeleri filtrele ve topla
            const thisMonthPayments = payments.filter(p => {
              const odemeTarihi = p.odemeTarihi || p.OdemeTarihi;
              if (!odemeTarihi) return false;
              
              // Ödeme tarihi null, boş string veya "null" string değilse ödenmiş demektir
              if (odemeTarihi === null || odemeTarihi === "" || odemeTarihi === "null" || odemeTarihi === "undefined") {
                return false;
              }
              
              const odemeDate = new Date(odemeTarihi);
              
              // Bu ay yapılan ödemeleri say
              return odemeDate.getMonth() === currentMonth && 
                     odemeDate.getFullYear() === currentYear;
            });
            
            // Tüm para birimlerini grupla ve topla
            const incomeByCurrency = {};
            thisMonthPayments.forEach(p => {
              const paraBirimi = p.paraBirimi || p.ParaBirimi || "TRY";
              const tutar = parseFloat(p.tutar || p.Tutar || 0);
              
              if (!incomeByCurrency[paraBirimi]) {
                incomeByCurrency[paraBirimi] = 0;
              }
              incomeByCurrency[paraBirimi] += tutar;
            });
            
            // TRY varsa onu göster, yoksa ilk para birimini göster
            if (incomeByCurrency["TRY"]) {
              monthIncome = incomeByCurrency["TRY"];
              currency = "TRY";
            } else if (Object.keys(incomeByCurrency).length > 0) {
              const firstCurrency = Object.keys(incomeByCurrency)[0];
              monthIncome = incomeByCurrency[firstCurrency];
              currency = firstCurrency;
            }
            
            // Eğer birden fazla para birimi varsa, hepsini göster
            const currencyKeys = Object.keys(incomeByCurrency);
            if (currencyKeys.length > 1) {
              const allCurrencies = currencyKeys.map(curr => {
                const symbol = curr === "TRY" ? "₺" : curr === "USD" ? "$" : curr === "EUR" ? "€" : curr;
                return incomeByCurrency[curr].toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + " " + symbol;
              }).join(" / ");
              monthIncomeEl.innerText = allCurrencies;
              return; // Early return
            }
          }
          
          // Para birimi sembolünü belirle
          const currencySymbol = currency === "TRY" ? "₺" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;
          monthIncomeEl.innerText = monthIncome.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + " " + currencySymbol;
        } catch (error) {
          monthIncomeEl.innerText = "0 ₺";
        }
      }
      
    }
  } catch (error) {
    // Hata durumunda varsayılan değerler
    const totalPropertiesEl = document.getElementById("totalProperties");
    if (totalPropertiesEl) totalPropertiesEl.innerText = "-";
    
    const activeContractsEl = document.getElementById("activeContracts");
    if (activeContractsEl) activeContractsEl.innerText = "-";
    
    const latePaymentsEl = document.getElementById("latePayments");
    if (latePaymentsEl) latePaymentsEl.innerText = "-";
    
    const monthIncomeEl = document.getElementById("monthIncome");
    if (monthIncomeEl) {
      // Hata durumunda da ödemeleri çekip manuel hesapla
      try {
        const payments = await API.get(`/KiraOdeme/owner/${user.kullaniciID}`);
        let monthIncome = 0;
        let currency = "TRY";
        
        if (payments && Array.isArray(payments)) {
          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();
          
          // Bu ay ödenen ödemeleri filtrele ve topla
          const thisMonthPayments = payments.filter(p => {
            const odemeTarihi = p.odemeTarihi || p.OdemeTarihi;
            if (!odemeTarihi) return false;
            
            // Ödeme tarihi null, boş string veya "null" string değilse ödenmiş demektir
            if (odemeTarihi === null || odemeTarihi === "" || odemeTarihi === "null" || odemeTarihi === "undefined") {
              return false;
            }
            
            const odemeDate = new Date(odemeTarihi);
            
            // Bu ay yapılan ödemeleri say
            return odemeDate.getMonth() === currentMonth && 
                   odemeDate.getFullYear() === currentYear;
          });
          
          // Tüm para birimlerini grupla ve topla
          const incomeByCurrency = {};
          thisMonthPayments.forEach(p => {
            const paraBirimi = p.paraBirimi || p.ParaBirimi || "TRY";
            const tutar = parseFloat(p.tutar || p.Tutar || 0);
            
            if (!incomeByCurrency[paraBirimi]) {
              incomeByCurrency[paraBirimi] = 0;
            }
            incomeByCurrency[paraBirimi] += tutar;
          });
          
          // TRY varsa onu göster, yoksa ilk para birimini göster
          if (incomeByCurrency["TRY"]) {
            monthIncome = incomeByCurrency["TRY"];
            currency = "TRY";
          } else if (Object.keys(incomeByCurrency).length > 0) {
            const firstCurrency = Object.keys(incomeByCurrency)[0];
            monthIncome = incomeByCurrency[firstCurrency];
            currency = firstCurrency;
          }
          
          // Eğer birden fazla para birimi varsa, hepsini göster
          const currencyKeys = Object.keys(incomeByCurrency);
          if (currencyKeys.length > 1) {
            const allCurrencies = currencyKeys.map(curr => {
              const symbol = curr === "TRY" ? "₺" : curr === "USD" ? "$" : curr === "EUR" ? "€" : curr;
              return incomeByCurrency[curr].toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + " " + symbol;
            }).join(" / ");
            monthIncomeEl.innerText = allCurrencies;
            return; // Early return
          }
        }
        
        // Para birimi sembolünü belirle
        const currencySymbol = currency === "TRY" ? "₺" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;
        monthIncomeEl.innerText = monthIncome.toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + " " + currencySymbol;
      } catch (fallbackError) {
        monthIncomeEl.innerText = "- ₺";
      }
    }
    
  }
}

// Sayfa yüklendiğinde çalış
document.addEventListener("DOMContentLoaded", () => {
  loadDashboardData();
});

// Sayfa görünür olduğunda verileri yenile (başka sekmeden dönünce)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    loadDashboardData();
  }
});

// Çıkış Yap Butonu
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});
