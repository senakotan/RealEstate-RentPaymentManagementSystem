namespace EmlakYonetimAPI.Models
{
    public class BankaHesap
    {
        public int BankaHesapID { get; set; }
        public int KullaniciID { get; set; }
        public int BankaID { get; set; }

        public string Iban { get; set; } = string.Empty;
        public string? HesapAdi { get; set; }
        public bool AktifMi { get; set; }
    }
}
