export default function AppLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-12">
      <div className="flex flex-col items-center space-y-3">
        {/* Modern, premium spinner */}
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-brand/10" />
          <div className="absolute inset-0 rounded-full border-4 border-t-brand animate-spin" />
        </div>
        <p className="text-xs font-semibold text-muted tracking-wider animate-pulse mt-2">
          กำลังโหลดข้อมูล...
        </p>
      </div>
    </div>
  );
}
