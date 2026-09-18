import { NextResponse } from "next/server";

const SHEET_ID = "1eiWM21mHk0U_3wvMkDD9SBGwBN5z642pzSKFKtxBIb0";
const GID_MOVIMIENTOS = "91002";

export interface Contrato {
  puesto: string;
  rubro: string;
  locatario: string;
  tipoContrato: string;
  fechaInicio: string;
  duracionMeses: number;
  graciaMeses: number;
  inicioPago: string;
  finContrato: string;
}

export interface Movimiento {
  fecha: string;
  idMovimiento: string;
  puesto: string;
  locatario: string;
  direccion: string;
  concepto: string;
  medio: string;
  monto: number;
  contraparte: string;
  observaciones: string;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  while (i < text.length) {
    const row: string[] = [];
    while (i < text.length && text[i] !== "\n") {
      if (text[i] === '"') {
        i++;
        let field = "";
        while (i < text.length) {
          if (text[i] === '"' && text[i + 1] === '"') {
            field += '"'; i += 2;
          } else if (text[i] === '"') {
            i++; break;
          } else {
            field += text[i++];
          }
        }
        row.push(field);
        if (text[i] === ",") i++;
      } else {
        let field = "";
        while (i < text.length && text[i] !== "," && text[i] !== "\n") {
          field += text[i++];
        }
        row.push(field.trim());
        if (text[i] === ",") i++;
      }
    }
    if (text[i] === "\n") i++;
    if (row.some((c) => c !== "")) rows.push(row);
  }
  return rows;
}

async function fetchCsv(gid?: string): Promise<string> {
  const url = gid
    ? `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`
    : `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
  return res.text();
}

export async function GET() {
  try {
    const [csvContratos, csvMovimientos] = await Promise.all([
      fetchCsv(),
      fetchCsv(GID_MOVIMIENTOS),
    ]);

    const rowsC = parseCsv(csvContratos).slice(1);
    const contratos: Contrato[] = rowsC
      .filter((r) => r[0])
      .map((r) => ({
        puesto: r[0] ?? "",
        rubro: r[1] ?? "",
        locatario: r[2] ?? "",
        tipoContrato: r[3] ?? "",
        fechaInicio: r[4] ?? "",
        duracionMeses: parseInt(r[5] ?? "0") || 0,
        graciaMeses: parseInt(r[6] ?? "0") || 0,
        inicioPago: r[7] ?? "",
        finContrato: r[8] ?? "",
      }));

    const rowsM = parseCsv(csvMovimientos).slice(1);
    const movimientos: Movimiento[] = rowsM
      .filter((r) => r[0])
      .map((r) => {
        const raw = (r[7] ?? "").replace(/[S\/\s,]/g, "").replace("−", "-").replace("–", "-");
        return {
          fecha: r[0] ?? "",
          idMovimiento: r[1] ?? "",
          puesto: r[2] ?? "",
          locatario: r[3] ?? "",
          direccion: r[4] ?? "",
          concepto: r[5] ?? "",
          medio: r[6] ?? "",
          monto: parseFloat(raw) || 0,
          contraparte: r[8] ?? "",
          observaciones: r[9] ?? "",
        };
      });

    return NextResponse.json({ contratos, movimientos });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
