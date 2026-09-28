import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { CircleAlert } from "lucide-react";
import { Button } from "./ui/button";

import allowedCountries from "@ui/lib/allowedCountries.json";

export function IPChecker() {
  const [language, setLanguage] = useState("ru");

  const countryQuery = useQuery({
    queryKey: ["country", language],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`http://ip-api.com/json?fields=country,countryCode&lang=${language || "en"}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      await new Promise((resolve) => setTimeout(resolve, 300));
      return data;
    },
    enabled: !!language,
    refetchInterval: 1000 * 30,
    staleTime: 1000 * 60 * 1,
  });

  const countryCode = countryQuery.data?.countryCode ? String(countryQuery.data.countryCode).toUpperCase() : null;
  const isBlocked = countryQuery.isSuccess && countryCode && !allowedCountries.includes(countryCode);

  return (
    <>
      {isBlocked && (
        <div className="bg-destructive/30 border-destructive mx-4 mt-4 flex flex-col items-center justify-between gap-4 rounded-md border px-3 py-3">
          <div className="flex w-full flex-row items-start justify-center gap-2">
            <CircleAlert className="text-foreground h-8 w-8 shrink-0 text-amber-400" />

            <p className="text-foreground w-[calc(100%-3rem)] text-sm">
              Ваше местоположение определено как <b>{countryQuery.data?.country || countryCode}</b>. Яндекс Музыка
              ограничена в этой стране (сервера блокируют воспроизведение с ошибкой «Раздел недоступен»). Для работы приложения
              необходимо использовать VPN или прокси с российским (или СНГ) IP-адресом из{" "}
              <a
                className="text-blue-300 underline hover:text-blue-400 cursor-pointer"
                href="https://yandex.ru/support/music/ru/access.html"
                onClick={(e) => {
                  e.preventDefault();
                  window.open("https://yandex.ru/support/music/ru/access.html", "_blank");
                }}
              >
                списка разрешённых локаций
              </a>
              .
            </p>
          </div>

          <Button
            variant="outline"
            className="text-foreground px-6"
            disabled={
              countryQuery.isRefetching || countryQuery.isFetching || countryQuery.isPending || countryQuery.isLoading
            }
            onClick={() => countryQuery.refetch()}
          >
            Проверить заново
          </Button>
        </div>
      )}
    </>
  );
}
