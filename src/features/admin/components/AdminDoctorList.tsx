import { useEffect, useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import '../styles/AdminDoctorList.css';
import PageLoader from '../../../shared/components/PageLoader';

const AdminDoctorList = () => {
    const { doctors, totalDoctors, currentPage, isLoading, error, fetchDoctors, updateDoctorAccessLevel, activateDoctor, deactivateDoctor } = useAdmin();
    const [pageSize] = useState(50);

    useEffect(() => {
        fetchDoctors(1);
    }, []);

    const handlePageChange = (newPage: number) => {
        fetchDoctors(newPage);
    };

    const totalPages = Math.ceil(totalDoctors / pageSize);

    if (isLoading && doctors.length === 0) {
        return <PageLoader message="Loading Doctors" />;
    }

    if (error) {
        return (
            <div className="admin-doctor-list">
                <h1>Manage Doctors</h1>
                <div className="error-message">{error}</div>
            </div>
        );
    }

    return (
        <div className="admin-doctor-list">
            <h1>Manage Doctors</h1>
            <div className="doctor-list-stats">
                <p>Total Doctors: <strong>{totalDoctors}</strong> | Page {currentPage} of {totalPages}</p>
            </div>

            <div className="table-responsive">
                <table className="doctors-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Full Name</th>
                            <th>Email</th>
                            <th>Specialty</th>
                            <th>Access Level</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {doctors.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="no-data">
                                    No doctors found
                                </td>
                            </tr>
                        ) : (
                            doctors.map((doctor) => (
                                <tr key={doctor.id} className={`doctor-row ${doctor.is_active ? 'active' : 'inactive'}`}>
                                    <td className="doctor-id" data-label="ID">{doctor.id}</td>
                                    <td className="doctor-name" data-label="Name">{doctor.full_name}</td>
                                    <td className="doctor-email" data-label="Email">{doctor.email}</td>
                                    <td className="doctor-specialty" data-label="Specialty">{doctor.specialty || 'N/A'}</td>
                                    <td className="doctor-access-level" data-label="Access Level">
                                        <select
                                            className={`access-level-select level-${doctor.access_level}`}
                                            value={doctor.access_level}
                                            onChange={(e) => updateDoctorAccessLevel(doctor.id, parseInt(e.target.value) as 1 | 2)}
                                        >
                                            <option value={1}>Level 1 (Basic)</option>
                                            <option value={2}>Level 2 (Advanced)</option>
                                        </select>
                                    </td>
                                    <td className="doctor-status" data-label="Status">
                                        <span className={`status-badge ${doctor.is_active ? 'status-active' : 'status-inactive'}`}>
                                            {doctor.is_active ? '✓ Active' : '✗ Inactive'}
                                        </span>
                                    </td>
                                    <td className="doctor-actions" data-label="Action">
                                        {doctor.is_active ? (
                                            <button
                                                className="btn btn-deactivate"
                                                onClick={() => deactivateDoctor(doctor.id)}
                                            >
                                                Deactivate
                                            </button>
                                        ) : (
                                            <button
                                                className="btn btn-activate"
                                                onClick={() => activateDoctor(doctor.id)}
                                            >
                                                Activate
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="pagination">
                    <button
                        className="pagination-btn"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                    >
                        ← Previous
                    </button>

                    <div className="pagination-info">
                        Page <input
                            type="number"
                            min="1"
                            max={totalPages}
                            value={currentPage}
                            onChange={(e) => {
                                const page = parseInt(e.target.value);
                                if (page >= 1 && page <= totalPages) {
                                    handlePageChange(page);
                                }
                            }}
                            className="page-input"
                        /> of {totalPages}
                    </div>

                    <button
                        className="pagination-btn"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
};

export default AdminDoctorList;
