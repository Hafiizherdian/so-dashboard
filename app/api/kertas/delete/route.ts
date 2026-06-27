// api/kertas/delete
import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest } from "@/lib/auth";
import { query, initDb } from "@/lib/db";


export async function DELETE(req: NextRequest) {
    try {
      const payload = await getTokenFromRequest(req);

      if (!payload) return NextResponse.json({success: false, error: 'sopo koe'}, { status: 401 });

      if (payload.role === 'user') return NextResponse.json({success: false, error: 'Raiso bos'}, { status: 403});
      await initDb();
      const id = req.nextUrl.searchParams.get('id');
      if (!id) return NextResponse.json({success: false, error: 'ID wajib diisi'}, {status: 400});
      await query('DELETE FROM kertas_uploads WHERE id=$1', [id]);
      return NextResponse.json({ success: true});
    } catch (e: any){
        return NextResponse.json({ succes: false, error: e.message}, { status: 500})
    }
}