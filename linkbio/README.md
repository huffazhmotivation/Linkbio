# Halaman tautan + panel admin

Situs di `/`, panel admin di `/admin`. Bisa di-deploy ke **Netlify** atau **Vercel** tanpa build step.

```
public/index.html        halaman utama
public/admin/index.html  panel admin
lib/core.js              login, validasi, penyimpanan (dipakai dua platform)
api/*.js                 fungsi untuk Vercel
netlify/functions/api.mjs  fungsi untuk Netlify
```

## Environment variable

| Nama | Wajib | Keterangan |
|---|---|---|
| `ADMIN_PASSWORD` | ya | Kata sandi masuk ke `/admin`. Pakai yang panjang. |
| `SESSION_SECRET` | tidak | String acak untuk menandatangani sesi. Kalau kosong, diturunkan dari `ADMIN_PASSWORD`. |

Sesi login berlaku 7 hari. Mengganti `ADMIN_PASSWORD` otomatis mengeluarkan semua sesi lama.

## Deploy ke Netlify

1. Upload folder ini ke repo GitHub.
2. Netlify → **Add new site → Import an existing project**, pilih repo. Pengaturan build sudah ada di `netlify.toml`.
3. **Site configuration → Environment variables**: tambahkan `ADMIN_PASSWORD`.
4. Deploy. Buka `https://situs-kamu.netlify.app/admin`.

Data tersimpan di Netlify Blobs, aktif otomatis tanpa setup tambahan.
Catatan: drag-and-drop folder di dashboard Netlify tidak menjalankan fungsi API; pakai Git atau `npx netlify deploy --prod`.

## Deploy ke Vercel

1. Upload folder ini ke repo GitHub.
2. Vercel → **Add New → Project**, pilih repo. Framework preset: **Other**. Biarkan build command kosong (`vercel.json` sudah mengatur folder `public`).
3. **Settings → Environment Variables**: tambahkan `ADMIN_PASSWORD`.
4. Tab **Storage** → **Create / Connect Database** → pilih **Upstash Redis** (ada paket gratis) → hubungkan ke project ini. Variabel `KV_REST_API_URL` dan `KV_REST_API_TOKEN` terisi sendiri.
5. **Redeploy**. Buka `https://situs-kamu.vercel.app/admin`.

Tanpa langkah 4, panel admin tetap bisa dibuka tapi tombol Simpan akan menampilkan pesan bahwa penyimpanan belum aktif.

Upstash juga bisa dipakai di Netlify: isi `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN`, maka Blobs tidak dipakai.

## Coba di komputer sendiri

```bash
npm install
ADMIN_PASSWORD=rahasia npm run dev     # http://localhost:8888  (admin: /admin/)
```

Data lokal disimpan di `.data/config.json`. Atau pakai `npx netlify dev` / `npx vercel dev`.

## Cara kerja singkat

- Halaman utama mengambil data dari `GET /api/links`. Kalau belum pernah disimpan, dipakai isi bawaan.
- Panel admin menyimpan lewat `PUT /api/links` (butuh token login). Server memvalidasi semua isian: tautan `javascript:` ditolak, warna harus hex, zona waktu harus valid.
- Pratinjau di admin mengirim data ke iframe lewat `postMessage`, jadi perubahan terlihat sebelum disimpan.
- Pintasan: `Ctrl/Cmd + S` untuk menyimpan.
