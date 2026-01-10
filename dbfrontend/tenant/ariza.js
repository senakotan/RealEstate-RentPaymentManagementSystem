document.addEventListener("DOMContentLoaded", async () => {
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }
  const user = JSON.parse(userStr);

  document.getElementById("headerUserName").innerText = user.adSoyad;
  document.getElementById(
    "userImg"
  ).src = `https://ui-avatars.com/api/?name=${user.adSoyad}&background=764ba2&color=fff`;

  // Mülk ID'sini ve geçmiş talepleri yükle
  await initPage(user.kullaniciID);
});

let currentMulkID = null;

async function initPage(userId) {
  try {
    // 1. Sözleşmeden Mülk ID bul
    const contracts = await API.get(
      `/KiraSozlesme?userId=${userId}&role=Tenant`
    );

    if (contracts && contracts.length > 0) {
      const activeContract = contracts.find((c) => c.aktifMi) || contracts[0];
      currentMulkID = activeContract.mulkID;

      // 2. Bu mülke ait talepleri çek
      // Kiracı kendi mülküne ait talepleri görür (Backend'deki GetByMulk metodu)
      loadRequests(currentMulkID);
    } else {
      document.getElementById("requestList").innerHTML =
        "<tr><td colspan='4'>Aktif bir eviniz yok.</td></tr>";
      document.getElementById("createRequestForm").style.display = "none";
    }
  } catch (e) {
    // Sessiz hata yönetimi
  }
}

async function loadRequests(mulkId) {
  const tbody = document.getElementById("requestList");
  try {
    const reqs = await API.get(`/BakimTalep/mulk/${mulkId}`);
    tbody.innerHTML = "";

    if (reqs && reqs.length > 0) {
      reqs.forEach((r) => {
        let statusColor = "orange";
        if (r.durum === "Devam Ediyor") statusColor = "#00d4ff";
        if (r.durum === "Tamamlandi") statusColor = "#00c853";

        const row = `
                    <tr>
                        <td>${new Date(r.talepTarihi).toLocaleDateString(
                          "tr-TR"
                        )}</td>
                        <td>${r.aciklama}</td>
                        <td><span style="color:${statusColor}; font-weight:600;">${
          r.durum
        }</span></td>
                        <td>${
                          r.gerceklesmeTarihi
                            ? new Date(r.gerceklesmeTarihi).toLocaleDateString(
                                "tr-TR"
                              ) + " tarihinde çözüldü."
                            : "-"
                        }</td>
                    </tr>
                `;
        tbody.innerHTML += row;
      });
    } else {
      tbody.innerHTML =
        "<tr><td colspan='4' style='text-align:center;'>Henüz bir talep oluşturmadınız.</td></tr>";
    }
  } catch (error) {
    // Sessiz hata yönetimi
  }
}

// Yeni Talep Gönder
document
  .getElementById("createRequestForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentMulkID) {
      alert("Mülk bilgisi bulunamadı.");
      return;
    }

    const aciklama = document.getElementById("aciklama").value;

    const data = {
      mulkID: currentMulkID,
      aciklama: aciklama,
      durum: "Acik",
      tahminiTutar: null,
    };

    const res = await API.post("/BakimTalep", data);
    if (res) {
      // Bildirim gönder
      try {
        // Sözleşmeden mülk ve sahip bilgilerini al
        const contracts = await API.get(
          `/KiraSozlesme?userId=${user.kullaniciID}&role=Tenant`
        );
        if (contracts && contracts.length > 0) {
          const activeContract = contracts.find((c) => c.aktifMi && c.mulkID === currentMulkID) || contracts[0];
          const ownerId = activeContract.mulkSahibiID || activeContract.MulkSahibiID;
          const propertyName = activeContract.mulkBaslik || activeContract.MulkBaslik || "Mülk";
          const tenantName = user.adSoyad;
          
          // Ev sahibine bildirim
          if (ownerId) {
            await Notifications.maintenanceRequestFromTenant(ownerId, tenantName, propertyName, aciklama);
          }
          
          // Kiracıya bildirim
          await Notifications.maintenanceRequestCreatedForTenant(user.kullaniciID, propertyName, aciklama);
          
          // Admin'e bildirim
          await Notifications.maintenanceRequestForAdmin(propertyName, aciklama, tenantName);
        }
      } catch (notifError) {
        // Sessiz hata yönetimi
      }
      
      alert("Talebiniz ev sahibine iletildi.");
      document.getElementById("aciklama").value = "";
      loadRequests(currentMulkID);
    }
  });

// Çıkış
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});
