import { expect, test } from '@playwright/test';

test('registration and first vehicle flow', async ({ page }, testInfo) => {
  const username = `e2e_${testInfo.project.name === 'mobile-chrome' ? 'm' : 'd'}_${Date.now()}`;

  await page.goto('/register');
  await page.getByLabel('Имя', { exact: true }).fill('E2E User');
  await page.getByLabel('Логин', { exact: true }).fill(username);
  await page.getByLabel(/Пароль/).fill('secure-password');
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/vehicles');
  await page.getByRole('button', { name: /Добавить автомобиль/ }).click();
  await page.getByPlaceholder(/Мой Camry/).fill('E2E Vehicle');
  await page.getByPlaceholder('Toyota').fill('Toyota');
  await page.getByPlaceholder('Camry', { exact: true }).fill('Camry');
  await page.getByRole('button', { name: 'Создать', exact: true }).click();

  await expect(page.getByText('E2E Vehicle')).toBeVisible();
});

test('health endpoint is publicly reachable', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({ status: 'ok' });
});

test('vehicle workspace dialogs validate, save and reset local state', async ({ page }, testInfo) => {
  const username = `dialog_${testInfo.project.name === 'mobile-chrome' ? 'm' : 'd'}_${Date.now()}`;

  await page.goto('/register');
  await page.getByLabel('Имя', { exact: true }).fill('Dialog Test User');
  await page.getByLabel('Логин', { exact: true }).fill(username);
  await page.getByLabel(/Пароль/).fill('secure-password');
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  const vehicleResponse = await page.request.post('/api/vehicles', {
    data: {
      displayName: 'Dialog Test Vehicle',
      make: 'Test',
      model: 'Car',
      year: 2024,
      currentMileage: 100,
      mileageUnit: 'km',
    },
  });
  expect(vehicleResponse.ok()).toBeTruthy();
  const { vehicle } = await vehicleResponse.json();
  await page.goto(`/vehicles/${vehicle.id}`);

  await page.getByRole('button', { name: 'Обновить пробег' }).click();
  await expect(page.getByRole('dialog', { name: 'Обновить пробег' })).toBeVisible();
  await page.getByLabel(/Новый пробег/).fill('50');
  await page.getByRole('button', { name: 'Обновить', exact: true }).click();
  await expect(page.getByText(/Уменьшение пробега допускается/)).toBeVisible();
  await page.getByLabel(/Новый пробег/).fill('150');
  await page.getByRole('button', { name: 'Обновить', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Обновить пробег' })).toBeHidden();
  await expect(page.getByText('150', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Добавить план ТО' }).click();
  await page.getByRole('button', { name: 'Создать план' }).click();
  await expect(page.getByText('Укажите название регламентной работы')).toBeVisible();
  await page.getByLabel(/Название ТО/).fill('План из диалога');
  await page.getByRole('button', { name: 'Создать план' }).click();
  await expect(page.getByText('План из диалога')).toBeVisible();

  await page.getByRole('tab', { name: 'История обслуживания' }).click();
  await page.getByRole('button', { name: 'Внести запись о ТО' }).click();
  await page.getByLabel(/Пробег/).fill('50');
  await page.getByLabel(/Название выполненной работы/).fill('Историческая работа');
  await page.getByRole('button', { name: 'Сохранить запись' }).click();
  await expect(page.getByText(/Пробег не может быть меньше текущего/)).toBeVisible();
  await page.getByLabel(/Пробег/).fill('200');
  await page.getByRole('button', { name: 'Сохранить запись' }).click();
  await expect(page.getByText('Историческая работа')).toBeVisible();

  await page.getByRole('button', { name: 'Отменить запись' }).click();
  await page.getByLabel(/Причина отмены/).fill('Проверка отмены');
  await page.getByRole('button', { name: 'Да, отменить работу' }).click();
  await expect(page.getByText('Отменено', { exact: true })).toBeVisible();
  await expect(page.getByText(/Проверка отмены/)).toBeVisible();

  await page.getByRole('tab', { name: 'Наблюдения' }).click();
  await page.getByRole('button', { name: 'Добавить симптом' }).click();
  await page.getByLabel(/Название неисправности/).fill('Проверить шум');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Проверить шум')).toBeVisible();

  await page.getByRole('button', { name: 'Добавить симптом' }).click();
  await expect(page.getByLabel(/Название неисправности/)).toHaveValue('');
});

test('currencies stay separate and ownership journal exports', async ({ page }, testInfo) => {
  const username = `money_${testInfo.project.name === 'mobile-chrome' ? 'm' : 'd'}_${Date.now()}`;
  await page.goto('/register');
  await page.getByLabel('Имя', { exact: true }).fill('Money Test User');
  await page.getByLabel('Логин', { exact: true }).fill(username);
  await page.getByLabel(/Пароль/).fill('secure-password');
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  const vehicleResponse = await page.request.post('/api/vehicles', {
    data: {
      displayName: 'Currency Vehicle',
      make: 'Test',
      model: 'Money',
      year: 2025,
      currentMileage: 1000,
      mileageUnit: 'km',
    },
  });
  const { vehicle } = await vehicleResponse.json();
  expect(vehicle.isPrimary).toBe(true);

  for (const [currency, total] of [['USD', 100], ['BYN', 250]] as const) {
    const response = await page.request.post(`/api/vehicles/${vehicle.id}/records`, {
      data: {
        performedAt: new Date().toISOString(),
        mileage: 1000,
        serviceName: `${currency} service`,
        laborCost: total,
        partsCost: 0,
        currency,
        planIds: [],
        observationIds: [],
      },
    });
    expect(response.ok()).toBeTruthy();
  }

  const dashboardResponse = await page.request.get(`/api/vehicles/${vehicle.id}/dashboard`);
  const dashboard = (await dashboardResponse.json()).dashboard;
  expect(dashboard.expenses.byCurrency).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ currency: 'USD', yearToDate: 100 }),
      expect.objectContaining({ currency: 'BYN', yearToDate: 250 }),
    ]),
  );

  const fuelResponse = await page.request.post(`/api/vehicles/${vehicle.id}/ownership`, {
    data: {
      kind: 'fuel',
      data: {
        filledAt: new Date().toISOString(),
        mileage: 1050,
        liters: 25,
        totalCost: 60,
        currency: 'BYN',
        fullTank: true,
      },
    },
  });
  expect(fuelResponse.ok()).toBeTruthy();

  const exportResponse = await page.request.get(`/api/vehicles/${vehicle.id}/export?format=pdf`);
  expect(exportResponse.ok()).toBeTruthy();
  expect(exportResponse.headers()['content-type']).toContain('application/pdf');
  const pdfBody = await exportResponse.body();
  expect(pdfBody.byteLength).toBeGreaterThan(1000);
  await testInfo.attach('autopulse-journal.pdf', {
    body: pdfBody,
    contentType: 'application/pdf',
  });
});
