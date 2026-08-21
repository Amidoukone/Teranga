'use strict';

const {
  createVehicleSchema,
  updateDriverComplianceSchema,
} = require('../../src/validators/vehicle.schemas');

describe('vehicle media references', () => {
  test('accepts local gallery uploads returned by the media endpoint', () => {
    const driver = updateDriverComplianceSchema.validate({
      profilePhotoUrl: '/uploads/mobility/chauffeur-awa.jpg',
      driverLicenseDocumentUrl: '/uploads/mobility/permis-awa.pdf',
    });
    expect(driver.error).toBeUndefined();

    const vehicle = createVehicleSchema.validate({
      vehicleType: 'motorcycle',
      brand: 'TVS',
      model: 'Neo',
      color: 'Noir',
      plateNumber: 'MOTO-001',
      photoUrl: '/uploads/mobility/moto-001.jpg',
    });
    expect(vehicle.error).toBeUndefined();
  });

  test('keeps rejecting arbitrary strings and unsafe local paths', () => {
    expect(
      updateDriverComplianceSchema.validate({ profilePhotoUrl: 'photo sur mon telephone' }).error
    ).toBeDefined();
    expect(
      updateDriverComplianceSchema.validate({ profilePhotoUrl: '/uploads/../secret.txt' }).error
    ).toBeDefined();
  });
});
