using Microsoft.Data.SqlClient;
using EmlakYonetimAPI.DbHelper;

namespace EmlakYonetimAPI.Helpers
{
    public static class AuthorizationHelper
    {
        /// <summary>
        /// Kullanıcının rolünü kontrol eder
        /// </summary>
        public static async Task<bool> HasRole(SqlConnection conn, int kullaniciId, string rolAdi)
        {
            string sql = @"
                SELECT COUNT(*)
                FROM KullaniciRol KR
                INNER JOIN Rol R ON R.RolID = KR.RolID
                WHERE KR.KullaniciID = @KullaniciID AND R.RolAdi = @RolAdi";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@KullaniciID", kullaniciId);
            cmd.Parameters.AddWithValue("@RolAdi", rolAdi);

            int count = (int)await cmd.ExecuteScalarAsync();
            return count > 0;
        }

        /// <summary>
        /// Kullanıcının Admin olup olmadığını kontrol eder
        /// </summary>
        public static async Task<bool> IsAdmin(SqlConnection conn, int kullaniciId)
        {
            return await HasRole(conn, kullaniciId, "Admin");
        }

        /// <summary>
        /// Kullanıcının Owner olup olmadığını kontrol eder
        /// </summary>
        public static async Task<bool> IsOwner(SqlConnection conn, int kullaniciId)
        {
            return await HasRole(conn, kullaniciId, "Owner");
        }

        /// <summary>
        /// Kullanıcının Tenant olup olmadığını kontrol eder
        /// </summary>
        public static async Task<bool> IsTenant(SqlConnection conn, int kullaniciId)
        {
            return await HasRole(conn, kullaniciId, "Tenant");
        }

        /// <summary>
        /// Mülkün sahibinin belirtilen kullanıcı olup olmadığını kontrol eder
        /// </summary>
        public static async Task<bool> IsMulkOwner(SqlConnection conn, int mulkId, int kullaniciId)
        {
            string sql = "SELECT COUNT(*) FROM Mulk WHERE MulkID = @MulkID AND SahipKullaniciID = @KullaniciID";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@MulkID", mulkId);
            cmd.Parameters.AddWithValue("@KullaniciID", kullaniciId);

            int count = (int)await cmd.ExecuteScalarAsync();
            return count > 0;
        }

        /// <summary>
        /// Sözleşmenin mülk sahibinin belirtilen kullanıcı olup olmadığını kontrol eder
        /// </summary>
        public static async Task<bool> IsSozlesmeOwner(SqlConnection conn, int sozlesmeId, int kullaniciId)
        {
            string sql = @"
                SELECT COUNT(*)
                FROM KiraSozlesme KS
                INNER JOIN Mulk M ON M.MulkID = KS.MulkID
                WHERE KS.KiraSozlesmeID = @SozlesmeID AND M.SahipKullaniciID = @KullaniciID";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@SozlesmeID", sozlesmeId);
            cmd.Parameters.AddWithValue("@KullaniciID", kullaniciId);

            int count = (int)await cmd.ExecuteScalarAsync();
            return count > 0;
        }

        /// <summary>
        /// Sözleşmenin kiracısının belirtilen kullanıcı olup olmadığını kontrol eder
        /// </summary>
        public static async Task<bool> IsSozlesmeTenant(SqlConnection conn, int sozlesmeId, int kullaniciId)
        {
            // Önce kullanıcının kiracı ID'sini bul
            string kiraciSql = "SELECT KiraciID FROM Kiraci WHERE KullaniciID = @KullaniciID";
            int? kiraciId = null;

            using (var cmd = new SqlCommand(kiraciSql, conn))
            {
                cmd.Parameters.AddWithValue("@KullaniciID", kullaniciId);
                var result = await cmd.ExecuteScalarAsync();
                if (result != null && result != DBNull.Value)
                    kiraciId = (int)result;
            }

            if (!kiraciId.HasValue)
                return false;

            string sql = @"
                SELECT COUNT(*)
                FROM KiraSozlesme
                WHERE KiraSozlesmeID = @SozlesmeID AND KiraciID = @KiraciID";

            using var cmd2 = new SqlCommand(sql, conn);
            cmd2.Parameters.AddWithValue("@SozlesmeID", sozlesmeId);
            cmd2.Parameters.AddWithValue("@KiraciID", kiraciId.Value);

            int count = (int)await cmd2.ExecuteScalarAsync();
            return count > 0;
        }

        /// <summary>
        /// Kullanıcının belirtilen ödeme kaydına erişim yetkisi olup olmadığını kontrol eder
        /// </summary>
        public static async Task<bool> CanAccessOdeme(SqlConnection conn, int odemeId, int kullaniciId)
        {
            // Admin her şeyi görebilir
            if (await IsAdmin(conn, kullaniciId))
                return true;

            // Owner kontrolü - ödemenin mülk sahibi mi?
            string ownerSql = @"
                SELECT COUNT(*)
                FROM KiraOdeme KO
                INNER JOIN KiraSozlesme KS ON KS.KiraSozlesmeID = KO.KiraSozlesmeID
                INNER JOIN Mulk M ON M.MulkID = KS.MulkID
                WHERE KO.KiraOdemeID = @OdemeID AND M.SahipKullaniciID = @KullaniciID";

            using (var cmd = new SqlCommand(ownerSql, conn))
            {
                cmd.Parameters.AddWithValue("@OdemeID", odemeId);
                cmd.Parameters.AddWithValue("@KullaniciID", kullaniciId);
                int count = (int)await cmd.ExecuteScalarAsync();
                if (count > 0)
                    return true;
            }

            // Tenant kontrolü - ödemenin kiracısı mı?
            string tenantSql = @"
                SELECT COUNT(*)
                FROM KiraOdeme KO
                INNER JOIN KiraSozlesme KS ON KS.KiraSozlesmeID = KO.KiraSozlesmeID
                INNER JOIN Kiraci K ON K.KiraciID = KS.KiraciID
                WHERE KO.KiraOdemeID = @OdemeID AND K.KullaniciID = @KullaniciID";

            using (var cmd = new SqlCommand(tenantSql, conn))
            {
                cmd.Parameters.AddWithValue("@OdemeID", odemeId);
                cmd.Parameters.AddWithValue("@KullaniciID", kullaniciId);
                int count = (int)await cmd.ExecuteScalarAsync();
                if (count > 0)
                    return true;
            }

            return false;
        }
    }
}

