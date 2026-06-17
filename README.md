# CORIMO HOME landing page

Landing page mobile-first pentru colectarea de lead-uri din audiența Angelicăi, construită ca experiență în 3 pași:

1. hook / intro pentru turul casei;
2. preview cu camerele incluse;
3. formular pentru acces la tur + ghid PDF.

## Fișiere

- `index.html` - structura paginii și formularul;
- `styles.css` - design responsive, mobile-first;
- `script.js` - flow-ul în 3 pași, captură UTM și submit AJAX;
- `api/corimo-leads.js` - endpoint serverless pentru webhook sau Klaviyo.

## Tracking

Pagina păstrează automat următoarele UTM-uri din URL și le trimite cu formularul:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`

Payload-ul include și `source`, `medium`, `campaign`, `content`, `landing_page`, `timestamp`, `interes_principal` și tag-ul `tur_casa`.

## Integrare lead capture

Endpoint-ul `/api/corimo-leads` trimite datele către una sau ambele integrări, în funcție de variabilele de mediu disponibile:

### Webhook generic

```bash
CORIMO_LEAD_WEBHOOK_URL=https://example.com/webhook
```

### Klaviyo

```bash
KLAVIYO_PRIVATE_API_KEY=pk_...
KLAVIYO_LIST_ID=...
KLAVIYO_REVISION=2026-04-15
```

Pentru Klaviyo, profilul este importat/actualizat cu proprietățile UTM, `interes_principal`, `tag: tur_casa` și este adăugat în lista configurată. Flow-ul de email cu turul + PDF-ul trebuie legat în Klaviyo de lista respectivă.

## Rulare locală

Pagina este statică și poate fi deschisă direct sau servită local:

```bash
python3 -m http.server 4173
```

Apoi deschide `http://localhost:4173`.
