import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// ============================================================
// GET /api/msmr
// Riwayat upload MSMR
// ============================================================
export async function GET() {
  try {
    const rows = await query(
      `
        SELECT
          u.id,
          u.file_name,
          u.status,
          u.created_at,

          COUNT(DISTINCT r.id)::int AS sheet_count,

          COUNT(pr.id)
            FILTER (WHERE pr.row_type = 'detail')::int
            AS total_rows

        FROM msmr_uploads u

        LEFT JOIN msmr_reports r
          ON r.upload_id = u.id
          AND r.deleted_at IS NULL

        LEFT JOIN msmr_rows pr
          ON pr.report_id = r.id

        GROUP BY
          u.id,
          u.file_name,
          u.status,
          u.created_at

        ORDER BY u.created_at DESC

        LIMIT 50
      `,
    );

    return NextResponse.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error(
      '[api/msmr] GET error:',
      err,
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Gagal mengambil riwayat upload',
      },
      { status: 500 },
    );
  }
}

// ============================================================
// DELETE /api/msmr?id=<upload_id>
// ============================================================
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      {
        success: false,
        error: 'id wajib diisi',
      },
      { status: 400 },
    );
  }

  try {
    const result = await query(
      `
        DELETE FROM msmr_uploads
        WHERE id = $1
        RETURNING id
      `,
      [id],
    );

    if (result.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Upload MSMR tidak ditemukan',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        deleted_id: result[0].id,
      },
    });
  } catch (err) {
    console.error(
      '[api/msmr] DELETE error:',
      err,
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Gagal menghapus upload',
      },
      { status: 500 },
    );
  }
}