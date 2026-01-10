let globalPayments = []; // Verileri tutmak için

document.addEventListener("DOMContentLoaded", async () => {
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }
  const user = JSON.parse(userStr);

  if (user.rol !== "Tenant") {
    alert("Bu sayfaya sadece kiracılar erişebilir.");
    window.location.href = "../index.html";
    return;
  }

  document.getElementById("headerUserName").innerText = user.adSoyad;
  document.getElementById(
    "userImg"
  ).src = `https://ui-avatars.com/api/?name=${user.adSoyad}&background=764ba2&color=fff`;

  // Önce aktif sözleşme kontrolü yap
  try {
    const contracts = await API.get(
      `/KiraSozlesme?userId=${user.kullaniciID}&role=Tenant`
    );
    
    // Aktif sözleşme var mı kontrol et
    const hasActiveContract = contracts && Array.isArray(contracts) && contracts.some(c => {
      const aktifMi = c.aktifMi !== undefined ? c.aktifMi : c.AktifMi;
      return aktifMi === true;
    });
    
    if (!hasActiveContract) {
      alert("Ödeme yapabilmek için aktif bir sözleşmeniz olmalıdır.\n\nLütfen önce mülk sahibi ile sözleşme yapın.");
      window.location.href = "dashboard.html";
      return;
    }
  } catch (contractCheckError) {
    // Sözleşme kontrolü başarısız olsa da devam et (loadPayments içinde tekrar kontrol edilecek)
  }

  await loadPayments(user.kullaniciID);
});

// Ödemeleri Yükle
async function loadPayments(userId) {
  const tbody = document.getElementById("paymentList");
  const debtCard = document.getElementById("debtCard");
  const totalDebtEl = document.getElementById("totalDebt");

  try {
    // A) Sözleşmeyi Bul
    const contracts = await API.get(
      `/KiraSozlesme?userId=${userId}&role=Tenant`
    );

    if (!contracts || contracts.length === 0) {
      tbody.innerHTML =
        "<tr><td colspan='5' style='text-align:center; padding:2rem; color:#ff4b5c;'><i class='fa-solid fa-exclamation-triangle'></i><br><br>Adınıza kayıtlı aktif bir sözleşme bulunamadı.<br>Ödeme yapabilmek için önce mülk sahibi ile sözleşme yapmanız gerekmektedir.</td></tr>";
      debtCard.style.display = "none";
      return;
    }

    // Sadece aktif sözleşmeyi bul
    const activeContract = contracts.find((c) => {
      const aktifMi = c.aktifMi !== undefined ? c.aktifMi : c.AktifMi;
      return aktifMi === true;
    });
    
    // Aktif sözleşme yoksa uyarı göster
    if (!activeContract) {
      tbody.innerHTML =
        "<tr><td colspan='5' style='text-align:center; padding:2rem; color:#ff4b5c;'><i class='fa-solid fa-exclamation-triangle'></i><br><br>Aktif bir sözleşmeniz bulunmamaktadır.<br>Ödeme yapabilmek için önce mülk sahibi ile aktif bir sözleşme yapmanız gerekmektedir.</td></tr>";
      debtCard.style.display = "none";
      return;
    }
    
    // Owner ID'yi bulmak için mülk bilgisini çek
    let ownerId = null;
    const mulkID = activeContract.mulkID || activeContract.MulkID;
    const ownerName = activeContract.mulkSahibiAd || activeContract.MulkSahibiAd || "Mülk Sahibi";
    
    if (mulkID) {
      try {
        // Önce tek mülk endpoint'ini dene
        try {
          const mulk = await API.get(`/Mulk/${mulkID}`);
          
          if (mulk) {
            // Önce direkt ID alanlarını kontrol et
            ownerId = mulk.sahipKullaniciID || mulk.SahipKullaniciID ||
                     mulk.sahipID || mulk.SahipID ||
                     mulk.kullaniciID || mulk.KullaniciID;
            
            // Eğer bulunamadıysa, sahipAdSoyad'a göre kullanıcıyı bul
            if (!ownerId && (mulk.sahipAdSoyad || ownerName)) {
              const sahipAd = mulk.sahipAdSoyad || ownerName;
              
              try {
                const allUsers = await API.get("/Kullanici");
                if (allUsers && Array.isArray(allUsers)) {
                  const owner = allUsers.find(u => {
                    const adSoyad = u.adSoyad || u.AdSoyad;
                    return adSoyad && adSoyad.trim().toLowerCase() === sahipAd.trim().toLowerCase();
                  });
                  
                  if (owner) {
                    ownerId = owner.kullaniciID || owner.KullaniciID;
                  }
                }
              } catch (userError) {
                console.error("Kullanıcı listesi çekilemedi:", userError);
              }
            }
          }
        } catch (singleError) {
          // Sessiz hata yönetimi
        }
        
        // Eğer hala bulunamadıysa, tüm mülkleri çekip filtrele
        if (!ownerId) {
          try {
            const allMulkler = await API.get("/Mulk");
            
            if (allMulkler && Array.isArray(allMulkler)) {
              const mulk = allMulkler.find(m => {
                const mID = m.mulkID || m.MulkID;
                return mID == mulkID || mID === parseInt(mulkID);
              });
              
              if (mulk) {
                ownerId = mulk.sahipKullaniciID || mulk.SahipKullaniciID ||
                         mulk.sahipID || mulk.SahipID ||
                         mulk.kullaniciID || mulk.KullaniciID;
                
                // Eğer hala bulunamadıysa, sahipAdSoyad'a göre kullanıcıyı bul
                if (!ownerId && (mulk.sahipAdSoyad || ownerName)) {
                  const sahipAd = mulk.sahipAdSoyad || ownerName;
                  try {
                    const allUsers = await API.get("/Kullanici");
                    if (allUsers && Array.isArray(allUsers)) {
                      const owner = allUsers.find(u => {
                        const adSoyad = u.adSoyad || u.AdSoyad;
                        return adSoyad && adSoyad.trim().toLowerCase() === sahipAd.trim().toLowerCase();
                      });
                      
                      if (owner) {
                        ownerId = owner.kullaniciID || owner.KullaniciID;
                      }
                    }
                  } catch (userError) {
                    // Sessiz hata yönetimi
                  }
                }
              }
            }
          } catch (allError) {
            // Sessiz hata yönetimi
          }
        }
      } catch (mulkError) {
        // Sessiz hata yönetimi
      }
    }
    
    // Son çare: Sadece sahipAdSoyad'a göre kullanıcıyı bul
    if (!ownerId && ownerName) {
      try {
        const allUsers = await API.get("/Kullanici");
        if (allUsers && Array.isArray(allUsers)) {
          const owner = allUsers.find(u => {
            const adSoyad = u.adSoyad || u.AdSoyad;
            return adSoyad && adSoyad.trim().toLowerCase() === ownerName.trim().toLowerCase();
          });
          
          if (owner) {
            ownerId = owner.kullaniciID || owner.KullaniciID;
          }
        }
      } catch (userError) {
        // Sessiz hata yönetimi
      }
    }
    
    window.hasBankAccount = false; // Global değişken - banka hesabı var mı?
    const bankInfoEl = document.querySelector(".bank-info");
    
    if (ownerId) {
      try {
        const bankAccounts = await API.get(`/BankaHesap/user/${ownerId}`);
        
        if (bankAccounts && Array.isArray(bankAccounts) && bankAccounts.length > 0) {
          // Önce aktif hesabı bul (AktifMi = true olan)
          let selectedAccount = bankAccounts.find(acc => {
            const aktifMi = acc.AktifMi !== undefined ? acc.AktifMi : acc.aktifMi;
            return aktifMi === true;
          });
          
          // Aktif hesap yoksa pasif hesaplardan birini al (eğer varsa)
          if (!selectedAccount && bankAccounts.length > 0) {
            selectedAccount = bankAccounts[0];
          }
          
          if (selectedAccount) {
            // IBAN kontrolü - Backend'de "Iban" olarak dönüyor (büyük I)
            const iban = selectedAccount.Iban || selectedAccount.iban || "";
            const bankName = selectedAccount.BankaAdi || selectedAccount.bankaAdi || "";
            const aktifMi = selectedAccount.AktifMi !== undefined ? selectedAccount.AktifMi : selectedAccount.aktifMi;
            
            // IBAN veya Banka adı varsa hesap geçerli (aktif veya pasif fark etmez)
            if ((iban && iban.trim() !== "" && iban !== "-") || (bankName && bankName.trim() !== "")) {
              // Sadece aktif hesap varsa kartla ödeme seçenekleri aktif olacak
              window.hasBankAccount = aktifMi === true;
              
              // Banka adını al - Backend'de "BankaAdi" olarak dönüyor (büyük B ve A)
              const displayBankName = bankName || "Banka";
              const displayIban = iban || "Girilmemiş";
              
              // Aktif veya pasif durumuna göre stil belirle
              const iconBg = aktifMi ? "rgba(0,212,255,0.1)" : "rgba(128,128,128,0.1)";
              const iconColor = aktifMi ? "#00d4ff" : "#888";
              const statusText = aktifMi ? "" : " <span style='color:#888; font-size:0.8rem;'>(Pasif)</span>";
              
              // Banka bilgisini güncelle - Aktif veya pasif durumuna göre
              if (bankInfoEl) {
                bankInfoEl.innerHTML = `
                  <div class="bank-icon" style="background:${iconBg}; color:${iconColor};"><i class="fa-solid fa-building-columns"></i></div>
                  <div>
                    <h4 style="color:#fff; margin-bottom:5px;">Ödeme Yapılacak Hesap${statusText}</h4>
                    <p style="color:#aaa; font-size:0.9rem;">
                      <strong>Banka:</strong> ${displayBankName}<br>
                      <strong>IBAN:</strong> ${displayIban}<br>
                      <strong>Alıcı:</strong> ${ownerName}
                    </p>
                  </div>
                `;
              }
            } else {
              // IBAN ve Banka adı yok - Girilmemiş göster
              window.hasBankAccount = false;
              if (bankInfoEl) {
                bankInfoEl.innerHTML = `
                  <div class="bank-icon" style="background:rgba(128,128,128,0.1); color:#888;"><i class="fa-solid fa-building-columns"></i></div>
                  <div>
                    <h4 style="color:#fff; margin-bottom:5px;">Ödeme Yapılacak Hesap</h4>
                    <p style="color:#aaa; font-size:0.9rem;">
                      <strong>Banka:</strong> Girilmemiş<br>
                      <strong>IBAN:</strong> Girilmemiş<br>
                      <strong>Alıcı:</strong> ${ownerName}
                    </p>
                  </div>
                `;
              }
            }
          } else {
            // Hesap bulunamadı - Girilmemiş göster
            window.hasBankAccount = false;
            if (bankInfoEl) {
              bankInfoEl.innerHTML = `
                <div class="bank-icon" style="background:rgba(128,128,128,0.1); color:#888;"><i class="fa-solid fa-building-columns"></i></div>
                <div>
                  <h4 style="color:#fff; margin-bottom:5px;">Ödeme Yapılacak Hesap</h4>
                  <p style="color:#aaa; font-size:0.9rem;">
                    <strong>Banka:</strong> Girilmemiş<br>
                    <strong>IBAN:</strong> Girilmemiş<br>
                    <strong>Alıcı:</strong> ${ownerName}
                  </p>
                </div>
              `;
            }
          }
        } else {
          // Banka hesabı yok - Girilmemiş göster
          window.hasBankAccount = false;
          if (bankInfoEl) {
            bankInfoEl.innerHTML = `
              <div class="bank-icon" style="background:rgba(128,128,128,0.1); color:#888;"><i class="fa-solid fa-building-columns"></i></div>
              <div>
                <h4 style="color:#fff; margin-bottom:5px;">Ödeme Yapılacak Hesap</h4>
                <p style="color:#aaa; font-size:0.9rem;">
                  <strong>Banka:</strong> Girilmemiş<br>
                  <strong>IBAN:</strong> Girilmemiş<br>
                  <strong>Alıcı:</strong> ${ownerName}
                </p>
              </div>
            `;
          }
        }
      } catch (e) {
        // Hata durumunda da "Girilmemiş" yaz
        window.hasBankAccount = false;
        if (bankInfoEl) {
          bankInfoEl.innerHTML = `
            <div class="bank-icon" style="background:rgba(128,128,128,0.1); color:#888;"><i class="fa-solid fa-building-columns"></i></div>
            <div>
              <h4 style="color:#fff; margin-bottom:5px;">Ödeme Yapılacak Hesap</h4>
              <p style="color:#aaa; font-size:0.9rem;">
                <strong>Banka:</strong> Girilmemiş<br>
                <strong>IBAN:</strong> Girilmemiş<br>
                <strong>Alıcı:</strong> ${ownerName}
              </p>
            </div>
          `;
        }
      }
    } else {
      // Owner ID yok - Girilmemiş göster
      window.hasBankAccount = false;
      if (bankInfoEl) {
        bankInfoEl.innerHTML = `
          <div class="bank-icon" style="background:rgba(128,128,128,0.1); color:#888;"><i class="fa-solid fa-building-columns"></i></div>
          <div>
            <h4 style="color:#fff; margin-bottom:5px;">Ödeme Yapılacak Hesap</h4>
            <p style="color:#aaa; font-size:0.9rem;">
              <strong>Banka:</strong> Girilmemiş<br>
              <strong>IBAN:</strong> Girilmemiş<br>
              <strong>Alıcı:</strong> ${ownerName}
            </p>
          </div>
        `;
      }
    }

    // B) Ödemeleri Çek - Sadece aktif sözleşmeye ait ödemeler
    const payments = await API.get(
      `/KiraOdeme/sozlesme/${activeContract.kiraSozlesmeID}`
    );

    // Ödemeleri filtrele - Sadece aktif sözleşmeye ait olanları al
    let filteredPayments = [];
    if (payments && Array.isArray(payments)) {
      filteredPayments = payments.filter(p => {
        const sozlesmeID = p.kiraSozlesmeID || p.KiraSozlesmeID;
        const activeSozlesmeID = activeContract.kiraSozlesmeID || activeContract.KiraSozlesmeID;
        // Sadece aktif sözleşmeye ait ödemeleri göster
        return sozlesmeID == activeSozlesmeID || sozlesmeID === activeSozlesmeID;
      });
    }

    // Globale kaydet - Sadece filtrelenmiş ödemeler
    globalPayments = filteredPayments;

    tbody.innerHTML = "";
    let totalDebt = 0;
    let currency = "TL";

    // Aktif sözleşme kontrolü - Eğer aktif sözleşme yoksa ödeme gösterilmez
    if (!activeContract) {
      tbody.innerHTML =
        "<tr><td colspan='5' style='text-align:center; padding:2rem; color:#ff4b5c;'><i class='fa-solid fa-exclamation-triangle'></i><br><br>Aktif bir sözleşmeniz bulunmamaktadır.<br>Ödeme yapabilmek için önce mülk sahibi ile aktif bir sözleşme yapmanız gerekmektedir.</td></tr>";
      debtCard.style.display = "none";
      return;
    }

    if (globalPayments.length > 0) {
      globalPayments.forEach((p) => {
        if (p.paraBirimi) currency = p.paraBirimi;

        // Ödeme durumunu tarih kontrolü ile hesapla (Backend'den gelen durum yerine)
        const vadeTarihi = p.vadeTarihi || p.VadeTarihi;
        const odemeTarihi = p.odemeTarihi || p.OdemeTarihi;
        const calculatedStatus = calculatePaymentStatus(vadeTarihi, odemeTarihi);
        const durum = calculatedStatus.status;
        const badgeClass = calculatedStatus.class;
        const badgeText = calculatedStatus.text;
        
        let isPayable = false; // Ödenebilir mi?
        
        // Paid değilse ödenebilir
        if (durum !== "Paid") {
          isPayable = true;
          // Gecikmişse borca ekle
          if (durum === "Late") {
            totalDebt += parseFloat(p.tutar || 0);
          }
        }

        // Tarihler - Null kontrolü ile
        const vade = vadeTarihi 
          ? new Date(vadeTarihi).toLocaleDateString("tr-TR")
          : "-";
        const vadeAy = vadeTarihi
          ? new Date(vadeTarihi).toLocaleDateString("tr-TR", {
              month: "long",
              year: "numeric",
            })
          : "-";
        const odemeTarihiFormatted = odemeTarihi
          ? new Date(odemeTarihi).toLocaleDateString("tr-TR")
          : "-";

        // İşlem Butonu - Her zaman aktif (banka bilgisi yoksa sadece nakit seçeneği olacak)
        let actionHtml = `<span style="color:#aaa;">-</span>`;
        if (durum === "Paid") {
          actionHtml = `<i class="fa-solid fa-check-circle" style="color:#00c853; font-size:1.2rem;"></i>`;
        } else if (isPayable) {
          // Ödeme butonu her zaman aktif
          actionHtml = `<button class="btn-pay" onclick="openPayModal(${
            p.kiraOdemeID || p.KiraOdemeID
          })">
                                    <i class="fa-solid fa-credit-card"></i> Öde
                                  </button>`;
        }

        const row = `
                    <tr>
                        <td>${vade}</td>
                        <td style="color:#ccc;">${vadeAy}</td>
                        <td style="font-weight:600; color:#fff;">${parseFloat(p.tutar || 0).toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${p.paraBirimi || "TL"}</td>
                        <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
                        <td>${actionHtml}</td>
                    </tr>
                `;
        tbody.innerHTML += row;
      });

      // Borç Kartı
      if (totalDebt > 0) {
        totalDebtEl.innerText = `${totalDebt.toLocaleString(
          "tr-TR"
        )} ${currency}`;
        debtCard.style.display = "flex";
      } else {
        debtCard.style.display = "none";
      }
    } else {
      tbody.innerHTML =
        "<tr><td colspan='5' style='text-align:center; padding:2rem;'>Henüz ödeme planı yok.</td></tr>";
    }
  } catch (error) {
    tbody.innerHTML =
      "<tr><td colspan='5' style='color:red; text-align:center;'>Veriler yüklenirken hata oluştu.</td></tr>";
  }
}

// --- MODAL İŞLEMLERİ ---

window.openPayModal = async function (id) {
  // Aktif sözleşme kontrolü
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) return;
  
  try {
    const contracts = await API.get(`/KiraSozlesme?userId=${user.kullaniciID}&role=Tenant`);
    const hasActiveContract = contracts && Array.isArray(contracts) && contracts.some(c => {
      const aktifMi = c.aktifMi !== undefined ? c.aktifMi : c.AktifMi;
      return aktifMi === true;
    });
    
    if (!hasActiveContract) {
      alert("Ödeme yapabilmek için aktif bir sözleşmeniz olmalıdır.");
      return;
    }
  } catch (checkError) {
    // Kontrol başarısız olsa da devam et
  }
  
  // Listeden veriyi bul
  const payment = globalPayments.find(
    (p) => (p.kiraOdemeID || p.KiraOdemeID) == id
  );
  if (!payment) {
    alert("Ödeme kaydı bulunamadı veya bu ödeme aktif sözleşmenize ait değil.");
    return;
  }
  
  // Ödeme kaydının aktif sözleşmeye ait olduğunu doğrula
  try {
    const contracts = await API.get(`/KiraSozlesme?userId=${user.kullaniciID}&role=Tenant`);
    const activeContract = contracts && Array.isArray(contracts) ? contracts.find(c => {
      const aktifMi = c.aktifMi !== undefined ? c.aktifMi : c.AktifMi;
      return aktifMi === true;
    }) : null;
    
    if (!activeContract) {
      alert("Aktif bir sözleşmeniz bulunmamaktadır. Ödeme yapabilmek için önce sözleşme yapmanız gerekmektedir.");
      return;
    }
    
    // Ödeme kaydının sözleşmeye ait olduğunu kontrol et
    const paymentSozlesmeID = payment.kiraSozlesmeID || payment.KiraSozlesmeID;
    const activeSozlesmeID = activeContract.kiraSozlesmeID || activeContract.KiraSozlesmeID;
    
    if (paymentSozlesmeID != activeSozlesmeID && paymentSozlesmeID !== activeSozlesmeID) {
      alert("Bu ödeme aktif sözleşmenize ait değil. Ödeme yapamazsınız.");
      return;
    }
  } catch (verifyError) {
    alert("Sözleşme doğrulaması yapılamadı. Lütfen tekrar deneyin.");
    return;
  }

  document.getElementById("payId").value = id;
  document.getElementById("payAmount").value = payment.tutar || payment.Tutar;
  document.getElementById("payDesc").value = "";

  // Tarih bilgisi - Null kontrolü ile
  const paymentVadeTarihi = payment.vadeTarihi || payment.VadeTarihi;
  const vadeTarihi = paymentVadeTarihi
    ? new Date(paymentVadeTarihi).toLocaleDateString("tr-TR", {
        month: "long",
        year: "numeric",
      })
    : "Belirtilmemiş";
  document.getElementById(
    "payModalText"
  ).innerHTML = `<strong>${vadeTarihi}</strong> ayı kirası için ödeme yapıyorsunuz.`;

  // Ödeme yöntemi seçeneklerini kontrol et
  const payMethodSelect = document.getElementById("payMethod");
  if (payMethodSelect) {
    // Tüm seçenekleri pasif yap
    Array.from(payMethodSelect.options).forEach(option => {
      option.disabled = true;
    });
    
    // Ödeme yöntemi notu
    const paymentMethodNote = document.getElementById("paymentMethodNote");
    
    // Banka hesabı varsa tüm seçenekler aktif
    if (window.hasBankAccount) {
      Array.from(payMethodSelect.options).forEach(option => {
        option.disabled = false;
      });
      if (paymentMethodNote) {
        paymentMethodNote.style.display = "none";
      }
    } else {
      // Banka hesabı yoksa sadece "Nakit" (Elden Ödeme) aktif
      const nakitOption = payMethodSelect.querySelector('option[value="3"]');
      if (nakitOption) {
        nakitOption.disabled = false;
        payMethodSelect.value = "3"; // Varsayılan olarak nakit seçili
      }
      if (paymentMethodNote) {
        paymentMethodNote.style.display = "block";
      }
    }
  }

  document.getElementById("payModal").style.display = "flex";
};

window.closePayModal = function () {
  document.getElementById("payModal").style.display = "none";
};

// Ödemeyi Tamamla
document.getElementById("payForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("payId").value;
  const user = JSON.parse(localStorage.getItem("user"));
  
  // Aktif sözleşme kontrolü
  try {
    const contracts = await API.get(`/KiraSozlesme?userId=${user.kullaniciID}&role=Tenant`);
    const hasActiveContract = contracts && Array.isArray(contracts) && contracts.some(c => {
      const aktifMi = c.aktifMi !== undefined ? c.aktifMi : c.AktifMi;
      return aktifMi === true;
    });
    
    if (!hasActiveContract) {
      alert("Ödeme yapabilmek için aktif bir sözleşmeniz olmalıdır.\n\nLütfen önce mülk sahibi ile sözleşme yapın.");
      closePayModal();
      return;
    }
  } catch (checkError) {
    alert("Sözleşme kontrolü yapılamadı. Lütfen tekrar deneyin.");
    return;
  }

  // Backend'e gönderilecek veri (Simüle edilmiş ödeme)
  const data = {
    odemeYontemID: document.getElementById("payMethod").value,
    tutar: document.getElementById("payAmount").value,
    aciklama: document.getElementById("payDesc").value,
    odemeTarihi: new Date().toISOString(), // Şu anki zaman
  };

  try {
    const submitBtn = e.target.querySelector("button[type=submit]");
    submitBtn.innerText = "İşleniyor...";
    submitBtn.disabled = true;

    // Ödemeyi Backend'e İşle (Owner ile aynı endpointi kullanıyoruz)
    const result = await API.put(`/KiraOdeme/pay/${id}`, data);

    if (result) {
      // Bildirim oluştur (hem kiracıya hem ev sahibine)
      try {
        const payment = globalPayments.find(
          (p) => (p.kiraOdemeID || p.KiraOdemeID) == id
        );
        if (payment) {
          const propertyName = payment.mulk || payment.MulkBaslik || "Mülk";
          const amount = payment.tutar || payment.Tutar;
          const currency = payment.paraBirimi || payment.ParaBirimi || "TRY";
          
          // Kiracıya bildirim
          await Notifications.paymentMade(user.kullaniciID, propertyName, amount, currency);
          
          // Ev sahibine bildirim (eğer sözleşme bilgisi varsa)
          const contracts = await API.get(`/KiraSozlesme?userId=${user.kullaniciID}&role=Tenant`);
          if (contracts && contracts.length > 0) {
            const activeContract = contracts.find((c) => c.aktifMi) || contracts[0];
            let ownerId = null;
            const ownerName = activeContract.mulkSahibiAd || activeContract.MulkSahibiAd;
            
            // Mülk ID'den sahip ID'sini al
            const mulkID = activeContract.mulkID || activeContract.MulkID;
            if (mulkID) {
              try {
                const mulk = await API.get(`/Mulk/${mulkID}`);
                if (mulk) {
                  ownerId = mulk.sahipKullaniciID || mulk.SahipKullaniciID ||
                           mulk.sahipID || mulk.SahipID ||
                           mulk.kullaniciID || mulk.KullaniciID;
                  
                  // Eğer bulunamadıysa, sahipAdSoyad'a göre kullanıcıyı bul
                  if (!ownerId && (mulk.sahipAdSoyad || ownerName)) {
                    const sahipAd = mulk.sahipAdSoyad || ownerName;
                    const allUsers = await API.get("/Kullanici");
                    if (allUsers && Array.isArray(allUsers)) {
                      const owner = allUsers.find(u => {
                        const adSoyad = u.adSoyad || u.AdSoyad;
                        return adSoyad && adSoyad.trim().toLowerCase() === sahipAd.trim().toLowerCase();
                      });
                      if (owner) {
                        ownerId = owner.kullaniciID || owner.KullaniciID;
                      }
                    }
                  }
                }
              } catch (mulkError) {
                // Sessiz hata yönetimi
              }
            }
            
            // Son çare: Sadece sahipAdSoyad'a göre kullanıcıyı bul
            if (!ownerId && ownerName) {
              try {
                const allUsers = await API.get("/Kullanici");
                if (allUsers && Array.isArray(allUsers)) {
                  const owner = allUsers.find(u => {
                    const adSoyad = u.adSoyad || u.AdSoyad;
                    return adSoyad && adSoyad.trim().toLowerCase() === ownerName.trim().toLowerCase();
                  });
                  if (owner) {
                    ownerId = owner.kullaniciID || owner.KullaniciID;
                  }
                }
              } catch (userError) {
                console.error("Kullanıcı listesi çekilemedi:", userError);
              }
            }
            
            if (ownerId) {
              await Notifications.paymentReceived(ownerId, user.adSoyad, amount, currency, propertyName);
              
              // Admin'e bildirim (owner adını bul)
              try {
                const allUsers = await API.get("/Kullanici");
                if (Array.isArray(allUsers)) {
                  const owner = allUsers.find(u => {
                    const uid = u.kullaniciID || u.KullaniciID || u.id || u.ID;
                    return uid == ownerId;
                  });
                  const ownerName = owner ? (owner.adSoyad || owner.AdSoyad || "Mülk Sahibi") : "Mülk Sahibi";
                  await Notifications.paymentReceivedForAdmin(ownerName, user.adSoyad, amount, currency, propertyName);
                }
              } catch (adminNotifError) {
                // Sessiz hata yönetimi
              }
            }
          }
        }
      } catch (notifError) {
        // Sessiz hata yönetimi
      }
      
      alert("Ödemeniz başarıyla alındı! Teşekkürler.");
      closePayModal();
      loadPayments(user.kullaniciID); // Listeyi yenile
    }
  } catch (error) {
    alert("Ödeme sırasında hata oluştu: " + error.message);
  }
});

// Çıkış
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});

// Ödeme durumunu tarih kontrolü ile hesapla
function calculatePaymentStatus(vadeTarihi, odemeTarihi) {
  // Null/undefined kontrolü
  if (!vadeTarihi && !odemeTarihi) {
    return {
      status: "Pending",
      class: "bg-pending",
      text: "Bekliyor"
    };
  }

  // Ödeme tarihi varsa → Paid
  if (odemeTarihi) {
    // String ise trim yap, değilse direkt kontrol et
    const odemeStr = typeof odemeTarihi === 'string' ? odemeTarihi.trim() : String(odemeTarihi);
    if (odemeStr !== "" && odemeStr !== "null" && odemeStr !== "undefined") {
      return {
        status: "Paid",
        class: "bg-paid",
        text: "Ödendi"
      };
    }
  }

  // Vade tarihi yoksa → Pending
  if (!vadeTarihi) {
    return {
      status: "Pending",
      class: "bg-pending",
      text: "Bekliyor"
    };
  }

  // String ise trim yap
  const vadeStr = typeof vadeTarihi === 'string' ? vadeTarihi.trim() : String(vadeTarihi);
  if (vadeStr === "" || vadeStr === "null" || vadeStr === "undefined") {
    return {
      status: "Pending",
      class: "bg-pending",
      text: "Bekliyor"
    };
  }

  // Tarih karşılaştırması (sadece tarih, saat bilgisi yok)
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const vadeDate = new Date(vadeTarihi);
    if (isNaN(vadeDate.getTime())) {
      // Geçersiz tarih
      return {
        status: "Pending",
        class: "bg-pending",
        text: "Bekliyor"
      };
    }
    
    vadeDate.setHours(0, 0, 0, 0);

    // Vade tarihi geçmişse → Late
    if (vadeDate < today) {
      return {
        status: "Late",
        class: "bg-late",
        text: "Gecikti"
      };
    }

    // Vade tarihi henüz gelmemişse → Pending
    return {
      status: "Pending",
      class: "bg-pending",
      text: "Bekliyor"
    };
  } catch (error) {
    // Tarih parse hatası
    console.error("Tarih parse hatası:", error, vadeTarihi);
    return {
      status: "Pending",
      class: "bg-pending",
      text: "Bekliyor"
    };
  }
}
