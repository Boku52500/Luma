import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/server/auth/admin";
import { getAdminDashboard } from "@/server/admin/orders";
import { formatPrice, formatGeorgianDate } from "@/lib/utils";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/adminLabels";
import { adminCardClass } from "@/components/admin/adminUi";

export const metadata: Metadata = { title: "მიმოხილვა" };

export default async function AdminDashboardPage() {
  await requireAdmin("/admin");
  const data = await getAdminDashboard();

  const metrics = [
    { label: "პროდუქტები", value: data.productCount },
    { label: "აქტიური პროდუქტები", value: data.activeProductCount },
    { label: "გამოუწვდომელი პროდუქტები", value: data.unavailableProductCount },
    { label: "შეკვეთები", value: data.orderCount },
    { label: "დასამუშავებელი შეკვეთები", value: data.pendingOrderCount },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-text">მიმოხილვა</h1>
        <p className="text-small mt-1 text-text-muted">ცოცხალი მონაცემები PostgreSQL-იდან.</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className={adminCardClass}>
            <p className="text-label text-text-faint">{metric.label}</p>
            <p className="tnum mt-1 text-2xl font-bold text-text">{metric.value}</p>
          </div>
        ))}
      </section>

      <section className={adminCardClass}>
        <h2 className="text-base font-semibold text-text">გადახდილი შეკვეთები</h2>
        <p className="text-small mt-1 text-text-muted">
          ეს ჯამი ითვლის მხოლოდ სტატუსით „გადახდილი“ შეკვეთებს. გადაუხდელი ან მოლოდინში შეკვეთები შემოსავლად არ ითვლება.
        </p>
        <p className="tnum mt-3 text-xl font-bold text-text">
          {formatPrice(data.paidOrderTotal)} · {data.paidOrderCount} შეკვეთა
        </p>
      </section>

      <section className={adminCardClass}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">ბოლო შეკვეთები</h2>
          <Link href="/admin/orders" className="text-small font-medium text-brand-800 hover:text-brand-900">
            ყველა
          </Link>
        </div>
        {data.recentOrders.length === 0 ? (
          <p className="text-small text-text-muted">შეკვეთები ჯერ არ არის.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-small">
              <thead className="text-label text-text-faint">
                <tr>
                  <th className="py-2 font-medium">ნომერი</th>
                  <th className="py-2 font-medium">მყიდველი</th>
                  <th className="py-2 font-medium">თარიღი</th>
                  <th className="py-2 font-medium">ჯამი</th>
                  <th className="py-2 font-medium">სტატუსი</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((order) => (
                  <tr key={order.id} className="border-t border-border">
                    <td className="py-2.5">
                      <Link href={`/admin/orders/${order.id}`} className="font-medium text-brand-700 hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="py-2.5">
                      {order.customerName || "—"}{" "}
                      <span className="text-text-faint">{order.isGuest ? "(სტუმარი)" : ""}</span>
                    </td>
                    <td className="py-2.5">{formatGeorgianDate(new Date(order.createdAt).getTime())}</td>
                    <td className="tnum py-2.5">{formatPrice(order.total)}</td>
                    <td className="py-2.5">
                      {ORDER_STATUS_LABEL[order.orderStatus]} · {PAYMENT_STATUS_LABEL[order.paymentStatus]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
