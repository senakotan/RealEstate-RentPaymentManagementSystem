namespace EmlakYonetimAPI.Models
{
    public class KiraOdeme
    {
        public int KiraOdemeID { get; set; }
        public int KiraSozlesmeID { get; set; }

        public DateTime VadeTarihi { get; set; } // Ödenmesi gereken tarih
        public DateTime? OdemeTarihi { get; set; } // Gerçekleþen tarih

        public decimal Tutar { get; set; }
        public int ParaBirimiID { get; set; }

        public int OdemeDurumID { get; set; } // 1: Paid, 2: Late, 3: Pending
        public int? OdemeYontemID { get; set; } // 1: Havale, 2: Nakit vs.

        public string? Aciklama { get; set; }
        public DateTime OlusturmaTarihi { get; set; }
    }
}