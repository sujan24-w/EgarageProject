const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/user.model');
const Garage = require('./models/garage.model');
const Mechanic = require('./models/mechanic.model');

dotenv.config();

const users = [
  { name: 'John User', email: 'user1@test.com', phone: '9840000001', password: 'password123', role: 'user' },
  { name: 'Jane Rider', email: 'user2@test.com', phone: '9840000002', password: 'password123', role: 'user' },
  { name: 'Ram Commuter', email: 'user3@test.com', phone: '9840000003', password: 'password123', role: 'user' },
  { name: 'Sita Voyager', email: 'user4@test.com', phone: '9840000004', password: 'password123', role: 'user' },
  { name: 'Hari Traveler', email: 'user5@test.com', phone: '9840000005', password: 'password123', role: 'user' },
];

const owners = [
  { name: 'Patan Owner', email: 'garage1@test.com', phone: '9850000001', password: 'password123', role: 'garage_owner' },
  { name: 'Bhakta Owner', email: 'garage2@test.com', phone: '9850000002', password: 'password123', role: 'garage_owner' },
  { name: 'Boudha Owner', email: 'garage3@test.com', phone: '9850000003', password: 'password123', role: 'garage_owner' },
  { name: 'Kalanki Owner', email: 'garage4@test.com', phone: '9850000004', password: 'password123', role: 'garage_owner' },
  { name: 'Thamel Owner', email: 'garage5@test.com', phone: '9850000005', password: 'password123', role: 'garage_owner' },
];

const garagesPayload = [
  { name: 'Patan Auto Works', phone: '9851111111', address: 'Patan Durbar Square', coords: [85.3253, 27.6756] },
  { name: 'Bhaktapur Mechanics', phone: '9852222222', address: 'Bhaktapur City Gate', coords: [85.4284, 27.6710] },
  { name: 'Boudha Scooter Pro', phone: '9853333333', address: 'Boudha Stupa Area', coords: [85.3612, 27.7215] },
  { name: 'Kalanki Roadside Assist', phone: '9854444444', address: 'Kalanki Chowk', coords: [85.2799, 27.6936] },
  { name: 'Thamel Quick Fix', phone: '9855555555', address: 'Thamel Marg', coords: [85.3123, 27.7150] },
];

const extraOwners = Array.from({ length: 20 }).map((_, i) => ({
  name: `Regional Owner ${i+1}`,
  email: `regional${i+1}@test.com`,
  phone: `98600000${i.toString().padStart(2, '0')}`,
  password: 'password123',
  role: 'garage_owner'
}));

const randomizeOffset = (base) => base + (Math.random() - 0.5) * 0.05;
const extraGaragesPayload = [];

// Generate 10 in Butwal / Bhairahawa region (Roughly 83.45 Longitude, 27.60 Latitude)
for(let i=0; i<10; i++) {
  extraGaragesPayload.push({
    name: `Butwal / Bhairahawa Zone Garage ${i+1}`,
    phone: `98611111${i.toString().padStart(2, '0')}`,
    address: `Lumbini Highway Zone ${i}`,
    coords: [randomizeOffset(83.45), randomizeOffset(27.60)]
  });
}

// Generate 5 in Pokhara (83.98 Longitude, 28.20 Latitude)
for(let i=0; i<5; i++) {
  extraGaragesPayload.push({
    name: `Pokhara Lake City Repairs ${i+1}`,
    phone: `98622222${i.toString().padStart(2, '0')}`,
    address: `Lakeside Pokhara Ward ${i}`,
    coords: [randomizeOffset(83.98), randomizeOffset(28.20)]
  });
}

// Generate 5 in Chitwan / Bharatpur (84.43 Longitude, 27.67 Latitude)
for(let i=0; i<5; i++) {
  extraGaragesPayload.push({
    name: `Chitwan Safari Motors ${i+1}`,
    phone: `98633333${i.toString().padStart(2, '0')}`,
    address: `Bharatpur Highway Hub ${i}`,
    coords: [randomizeOffset(84.43), randomizeOffset(27.67)]
  });
}

const allOwners = [...owners, ...extraOwners];
const allGaragesPayload = [...garagesPayload, ...extraGaragesPayload];

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected for Seeding...');

    // Clear existing test data EXCEPT ADMIN
    await User.deleteMany({ email: { $ne: 'admin@egarage.com' } });
    await Garage.deleteMany();
    await Mechanic.deleteMany();

    // 1. Insert Normal Users
    await User.create(users);
    console.log('✅ 5 Standard Users Injected');

    // 2. Insert Garage Owners (including expanded regions)
    const insertedOwners = await User.insertMany(allOwners);
    console.log(`✅ ${allOwners.length} Garage Owners Injected`);

    // 3. Insert Garages directly linked to the newly created Garage Owners
    const garages = allGaragesPayload.map((g, index) => ({
      ownerId: insertedOwners[index]._id,
      name: g.name,
      phone: g.phone,
      location: {
        type: "Point",
        coordinates: g.coords, // [longitude, latitude]
        address: g.address
      },
      isVerified: true, // Auto-verify them so they show up in Search & Map!
      images: ['https://images.unsplash.com/photo-1625805799797-2804f3295982?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80']
    }));

    const insertedGarages = await Garage.insertMany(garages);
    console.log(`✅ ${allGaragesPayload.length} Verified Garages Injected with Spacial Map Coordinates (Kathmandu, Butwal, Pokhara, Chitwan)`);

    // 4. Inject 1 Mechanic per Garage
    const mechanics = insertedGarages.map((garage, index) => ({
      garageId: garage._id,
      name: `Mechanic Node ${index + 1}`,
      phone: `980000000${index}`,
      status: 'available'
    }));
    await Mechanic.insertMany(mechanics);
    console.log(`✅ ${mechanics.length} Mechanics Linked & Available`);

    console.log('🎉 SEEDING COMPLETE! You can now test the Map and Searching exactly as expected.');
    process.exit();
  } catch (error) {
    console.error('❌ Seeding Failed:', error);
    process.exit(1);
  }
};

seedData();
