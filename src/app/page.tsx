import LocaleLayout from "./[locale]/layout";
import MainLayout from "./[locale]/(main)/layout";
import HomePage, {
  generateMetadata as generateHomeMetadata,
} from "./[locale]/(main)/page";

const DEFAULT_LOCALE = "es-419";

function createDefaultParams() {
  return Promise.resolve({ locale: DEFAULT_LOCALE });
}

export async function generateMetadata() {
  return generateHomeMetadata({ params: createDefaultParams() });
}

export default async function RootPage() {
  return (
    <LocaleLayout params={createDefaultParams()}>
      <MainLayout>
        <HomePage params={createDefaultParams()} />
      </MainLayout>
    </LocaleLayout>
  );
}
