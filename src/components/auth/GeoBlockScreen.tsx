export default function GeoBlockScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl">🚫</div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Servicio no disponible en tu región
          </h1>
          <p className="text-muted-foreground">
            PlayFunded no está disponible en los Estados Unidos en este momento.
            Estamos trabajando para expandir nuestros servicios.
          </p>
        </div>

        <div className="border-t border-border" />

        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            Service Not Available in Your Region
          </h2>
          <p className="text-muted-foreground text-sm">
            PlayFunded is not currently available in the United States. We are
            working to expand our services to your region.
          </p>
        </div>

        <p className="text-muted-foreground text-xs">
          Error: GEO_RESTRICTED_US
        </p>
      </div>
    </div>
  );
}
