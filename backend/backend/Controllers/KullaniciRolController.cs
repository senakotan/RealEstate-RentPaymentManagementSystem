using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using EmlakYonetimAPI.DbHelper;
using EmlakYonetimAPI.Models;

namespace EmlakYonetimAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class KullaniciRolController : ControllerBase
    {
        [HttpPost("assign")]
        public async Task<ActionResult> AssignRole(KullaniciRol model)
        {
            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            var sql = @"INSERT INTO KullaniciRol (KullaniciID, RolID, AtamaTarihi)
                        VALUES (@KullaniciID, @RolID, GETDATE())";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@KullaniciID", model.KullaniciID);
            cmd.Parameters.AddWithValue("@RolID", model.RolID);

            await cmd.ExecuteNonQueryAsync();

            return Ok("Rol kullanýcýya baþarýyla atandý.");
        }
        
        [HttpGet("user/{kullaniciId}")]
        public async Task<ActionResult> GetUserRoles(int kullaniciId)
        {
            var roles = new List<string>();

            using var conn = Connection.GetConnection();
            await conn.OpenAsync();

            var sql = @"SELECT R.RolAdi 
                        FROM KullaniciRol KR
                        INNER JOIN Rol R ON KR.RolID = R.RolID
                        WHERE KR.KullaniciID = @KullaniciID";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@KullaniciID", kullaniciId);

            using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
                roles.Add(reader.GetString(0));

            return Ok(roles);
        }
    }
}
